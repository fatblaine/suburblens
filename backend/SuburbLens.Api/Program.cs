using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Dapper;
using Npgsql;
using System.Data;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// camelCase JSON responses
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

// Lambda hosting
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Connection string resolution (once at startup; baked into SnapStart snapshot):
//  1. Local dev: SUPABASE_DB_URL from appsettings.Development.json / env var.
//  2. Cloud: fetched & decrypted from an SSM SecureString parameter — the secret
//     never lives in git, the CloudFormation template, or the Lambda env vars.
var connStr = builder.Configuration["SUPABASE_DB_URL"];
if (string.IsNullOrWhiteSpace(connStr))
{
    var paramName = builder.Configuration["DB_URL_SSM_PARAM"] ?? "/suburblens/supabase-db-url";
    using var ssm = new AmazonSimpleSystemsManagementClient();
    var resp = await ssm.GetParameterAsync(new GetParameterRequest
    {
        Name = paramName,
        WithDecryption = true
    });
    connStr = resp.Parameter.Value;
}
if (string.IsNullOrWhiteSpace(connStr))
    throw new InvalidOperationException("Database connection string could not be resolved (SUPABASE_DB_URL / DB_URL_SSM_PARAM).");

// Npgsql — connection left closed; Dapper opens/closes per query
builder.Services.AddScoped<IDbConnection>(_ => new NpgsqlConnection(connStr));

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(p => p
        .WithOrigins(
            "http://localhost:5173",
            "https://main.d1yrvhzuhaioqy.amplifyapp.com",
            "https://dev.d1yrvhzuhaioqy.amplifyapp.com"
        )
        .AllowAnyMethod()
        .AllowAnyHeader());
});

// Swagger (开发环境)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "SuburbLens API", Version = "v1" });
});

var app = builder.Build();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// === API Endpoints ===

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Fuzzy search suburbs by name (for autocomplete) - only Sydney/Melbourne for now
app.MapGet("/api/suburbs/search", async (IDbConnection db, string q) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
        return Results.BadRequest(new { error = "Query must be at least 2 characters" });

    var results = await db.QueryAsync<SuburbSearchResult>(@"
        SELECT sal_code AS SalCode, sal_name AS SalName,
               state_name AS StateName, gccsa_name AS GccsaName
        FROM geo_sal
        WHERE sal_name ILIKE @contains
          AND gccsa_code IN ('1GSYD', '2GMEL')
        ORDER BY
            CASE
                WHEN sal_name ILIKE @exact  THEN 0   -- exact name match
                WHEN sal_name ILIKE @prefix THEN 1   -- starts with the query
                WHEN sal_name ILIKE @word   THEN 2   -- a later word starts with the query
                ELSE 3                                -- contains the query somewhere
            END,
            length(sal_name),   -- within a tier, shorter names rank as closer matches
            sal_name            -- alphabetical tie-breaker
        LIMIT 10",
        new
        {
            exact    = q,
            prefix   = $"{q}%",
            word     = $"% {q}%",
            contains = $"%{q}%",
        });

    return Results.Ok(results);
});

// Batch fuzzy search by suburb name
app.MapGet("/api/suburbs/search/batch", async (IDbConnection db, string[] names) =>
{
    if (names == null || names.Length == 0)
        return Results.BadRequest(new { error = "Names query parameter is required" });

    var patterns = names
        .Where(n => !string.IsNullOrWhiteSpace(n) && n.Trim().Length >= 2)
        .Select(n => $"%{n.Trim()}%")
        .ToArray();

    if (patterns.Length == 0)
        return Results.BadRequest(new { error = "Each name must be at least 2 characters" });

    var results = await db.QueryAsync<SuburbSearchResult>(@"
        SELECT sal_code AS SalCode, sal_name AS SalName,
               state_name AS StateName, gccsa_name AS GccsaName
        FROM geo_sal
        WHERE sal_name ILIKE ANY(@patterns)
          AND gccsa_code IN ('1GSYD', '2GMEL')
        ORDER BY sal_name",
        new { patterns });

    return Results.Ok(results);
});

// Get tenure data for a suburb by SAL code
app.MapGet("/api/suburbs/{salCode}/tenure", async (IDbConnection db, string salCode) =>
{
    var row = await db.QuerySingleOrDefaultAsync<TenureRow>(@"
        SELECT
            sal_code AS SalCode, sal_name AS SalName,
            state_name AS StateName, gccsa_name AS GccsaName,
            sa2_code AS Sa2Code, sa2_name AS Sa2Name,
            outright_2011 AS Outright2011, outright_2016 AS Outright2016, outright_2021 AS Outright2021,
            mortgage_2011 AS Mortgage2011, mortgage_2016 AS Mortgage2016, mortgage_2021 AS Mortgage2021,
            rent_2011 AS Rent2011, rent_2016 AS Rent2016, rent_2021 AS Rent2021,
            total_dwellings_2011 AS TotalDwellings2011,
            total_dwellings_2016 AS TotalDwellings2016,
            total_dwellings_2021 AS TotalDwellings2021,
            residency_shift_index AS ResidencyShiftIndex, trend_label AS TrendLabel
        FROM v_tenure_shift
        WHERE sal_code = @salCode",
        new { salCode });

    if (row is null)
        return Results.NotFound(new { error = $"Suburb not found: {salCode}" });

    var response = new TenureResponse(
        SalCode: row.SalCode,
        SalName: row.SalName,
        StateName: row.StateName,
        GccsaName: row.GccsaName,
        Sa2Code: row.Sa2Code,
        Sa2Name: row.Sa2Name,
        Tenure: new TenureByYear(
            Outright: new YearValues(row.Outright2011, row.Outright2016, row.Outright2021),
            Mortgage: new YearValues(row.Mortgage2011, row.Mortgage2016, row.Mortgage2021),
            Rent: new YearValues(row.Rent2011, row.Rent2016, row.Rent2021),
            TotalDwellings: new YearCounts(row.TotalDwellings2011, row.TotalDwellings2016, row.TotalDwellings2021)
        ),
        ResidencyShiftIndex: row.ResidencyShiftIndex,
        TrendLabel: row.TrendLabel,
        DataNote: $"Cross-year data is based on the ABS SA2 '{row.Sa2Name}', which may include nearby suburbs."
    );

    return Results.Ok(response);
});

// Batch tenure lookup by SAL code
app.MapGet("/api/suburbs/tenure/batch", async (IDbConnection db, string[] salCodes) =>
{
    if (salCodes == null || salCodes.Length == 0)
        return Results.BadRequest(new { error = "salCodes query parameter is required" });

    var rows = await db.QueryAsync<TenureRow>(@"
        SELECT
            sal_code AS SalCode, sal_name AS SalName,
            state_name AS StateName, gccsa_name AS GccsaName,
            sa2_code AS Sa2Code, sa2_name AS Sa2Name,
            outright_2011 AS Outright2011, outright_2016 AS Outright2016, outright_2021 AS Outright2021,
            mortgage_2011 AS Mortgage2011, mortgage_2016 AS Mortgage2016, mortgage_2021 AS Mortgage2021,
            rent_2011 AS Rent2011, rent_2016 AS Rent2016, rent_2021 AS Rent2021,
            total_dwellings_2011 AS TotalDwellings2011,
            total_dwellings_2016 AS TotalDwellings2016,
            total_dwellings_2021 AS TotalDwellings2021,
            residency_shift_index AS ResidencyShiftIndex, trend_label AS TrendLabel
        FROM v_tenure_shift
        WHERE sal_code = ANY(@salCodes)",
        new { salCodes });

    var response = rows.Select(row => new TenureResponse(
        SalCode: row.SalCode,
        SalName: row.SalName,
        StateName: row.StateName,
        GccsaName: row.GccsaName,
        Sa2Code: row.Sa2Code,
        Sa2Name: row.Sa2Name,
        Tenure: new TenureByYear(
            Outright: new YearValues(row.Outright2011, row.Outright2016, row.Outright2021),
            Mortgage: new YearValues(row.Mortgage2011, row.Mortgage2016, row.Mortgage2021),
            Rent: new YearValues(row.Rent2011, row.Rent2016, row.Rent2021),
            TotalDwellings: new YearCounts(row.TotalDwellings2011, row.TotalDwellings2016, row.TotalDwellings2021)
        ),
        ResidencyShiftIndex: row.ResidencyShiftIndex,
        TrendLabel: row.TrendLabel,
        DataNote: $"Cross-year data is based on the ABS SA2 '{row.Sa2Name}', which may include nearby suburbs."
    )).ToArray();

    return Results.Ok(response);
});

// Find nearby suburbs of the designated suburb
app.MapGet("/api/suburbs/{salCode}/nearby", async (IDbConnection db, string salCode, int limit = 5) =>
{
    if (limit < 1 || limit > 10) limit = 5;

    // 先确认目标 suburb 存在
    var target = await db.QuerySingleOrDefaultAsync<SuburbSearchResult>(@"
        SELECT sal_code AS SalCode, sal_name AS SalName,
               state_name AS StateName, gccsa_name AS GccsaName
        FROM geo_sal
        WHERE sal_code = @salCode",
        new { salCode });

    if (target is null)
        return Results.NotFound(new { error = $"Suburb not found: {salCode}" });

    // 用子查询直接引用目标的 centroid，避免 text 转换导致的格式问题
    var nearby = await db.QueryAsync<NearbySuburbResult>(@"
        SELECT
            g.sal_code   AS SalCode,
            g.sal_name   AS SalName,
            g.state_name AS StateName,
            g.gccsa_name AS GccsaName,
            ROUND(ST_Distance(
                g.centroid,
                ref.centroid
            )::numeric, 0)::int AS DistanceMeters
        FROM geo_sal g
        CROSS JOIN (
            SELECT centroid FROM geo_sal WHERE sal_code = @salCode
        ) ref
        WHERE
            g.sal_code != @salCode
            AND g.gccsa_code IN ('1GSYD', '2GMEL')
            AND g.centroid IS NOT NULL
            AND ST_DWithin(g.centroid, ref.centroid, 20000)
        ORDER BY DistanceMeters ASC
        LIMIT @limit",
        new { salCode, limit });

    return Results.Ok(new
    {
        suburb = new { target.SalCode, target.SalName },
        nearby = nearby
    });
});

// Get language data for a suburb by SAL code
app.MapGet("/api/suburbs/{salCode}/language", async (IDbConnection db, string salCode) =>
{
    var rows = await db.QueryAsync<LanguageRow>(@"
          SELECT
              sal_code AS SalCode, sal_name AS SalName,
              state_name AS StateName, gccsa_name AS GccsaName,
              sa2_code AS Sa2Code, sa2_name AS Sa2Name,
              census_year AS CensusYear, total_persons AS TotalPersons,
              english_only_pct AS EnglishOnlyPct, arabic_pct AS ArabicPct,
              aus_indigenous_pct AS AusIndigenousPct, bengali_pct AS BengaliPct,
              cantonese_pct AS CantonesePct, mandarin_pct AS MandarinPct,
              chinese_other_pct AS ChineseOtherPct, chinese_total_pct AS ChineseTotalPct,
              croatian_pct AS CroatianPct, filipino_pct AS FilipinosPct,
              french_pct AS FrenchPct, german_pct AS GermanPct,
              greek_pct AS GreekPct, gujarati_pct AS GujaratiPct,
              hindi_pct AS HindiPct, indonesian_pct AS IndonesianPct,
              italian_pct AS ItalianPct, japanese_pct AS JapanesePct,
              korean_pct AS KoreanPct, macedonian_pct AS MacedonianPct,
              malayalam_pct AS MalayalamPct, nepali_pct AS NepaliPct,
              persian_dari_pct AS PersianDariPct, portuguese_pct AS PortuguesePct,
              punjabi_pct AS PunjabiPct, russian_pct AS RussianPct,
              serbian_pct AS SerbianPct, sinhalese_pct AS SinhalesePct,
              spanish_pct AS SpanishPct, tagalog_pct AS TagalogPct,
              tamil_pct AS TamilPct, thai_pct AS ThaiPct,
              turkish_pct AS TurkishPct, urdu_pct AS UrduPct,
              vietnamese_pct AS VietnamesePct, other_language_pct AS OtherLanguagePct
          FROM v_language_profile
          WHERE sal_code = @salCode
          ORDER BY census_year",
          new { salCode });

    var rowList = rows.ToList();
    if (rowList.Count == 0)
        return Results.NotFound(new { error = $"Suburb not found: {salCode}" });

    var first = rowList[0];
    var byYear = rowList.ToDictionary(r => r.CensusYear);

    static LanguageYearData? ToYearData(Dictionary<short, LanguageRow> d, short year)
    {
        if (!d.TryGetValue(year, out var r)) return null;
        var languages = new[]
        {
            new LanguageEntry("English only",    r.EnglishOnlyPct),
            new LanguageEntry("Mandarin",         r.MandarinPct),
            new LanguageEntry("Cantonese",        r.CantonesePct),
            new LanguageEntry("Arabic",           r.ArabicPct),
            new LanguageEntry("Vietnamese",       r.VietnamesePct),
            new LanguageEntry("Hindi",            r.HindiPct),
            new LanguageEntry("Punjabi",          r.PunjabiPct),
            new LanguageEntry("Spanish",          r.SpanishPct),
            new LanguageEntry("Italian",          r.ItalianPct),
            new LanguageEntry("Greek",            r.GreekPct),
            new LanguageEntry("Tagalog",          r.TagalogPct),
            new LanguageEntry("Korean",           r.KoreanPct),
            new LanguageEntry("Tamil",            r.TamilPct),
            new LanguageEntry("Bengali",          r.BengaliPct),
            new LanguageEntry("Gujarati",         r.GujaratiPct),
            new LanguageEntry("Indonesian",       r.IndonesianPct),
            new LanguageEntry("Nepali",           r.NepaliPct),
            new LanguageEntry("French",           r.FrenchPct),
            new LanguageEntry("Urdu",             r.UrduPct),
            new LanguageEntry("Persian/Dari",     r.PersianDariPct),
            new LanguageEntry("Japanese",         r.JapanesePct),
            new LanguageEntry("Malayalam",        r.MalayalamPct),
            new LanguageEntry("Portuguese",       r.PortuguesePct),
            new LanguageEntry("Russian",          r.RussianPct),
            new LanguageEntry("Turkish",          r.TurkishPct),
            new LanguageEntry("Serbian",          r.SerbianPct),
            new LanguageEntry("German",           r.GermanPct),
            new LanguageEntry("Filipino",         r.FilipinosPct),
            new LanguageEntry("Croatian",         r.CroatianPct),
            new LanguageEntry("Macedonian",       r.MacedonianPct),
            new LanguageEntry("Sinhalese",        r.SinhalesePct),
            new LanguageEntry("Thai",             r.ThaiPct),
            new LanguageEntry("Aus. Indigenous",  r.AusIndigenousPct),
            new LanguageEntry("Chinese (other)",  r.ChineseOtherPct),
            new LanguageEntry("Other",            r.OtherLanguagePct),
        }
        .Where(e => e.Pct > 0)
        .OrderByDescending(e => e.Pct)
        .ToArray();
        return new LanguageYearData(r.TotalPersons, languages);
    }

    return Results.Ok(new LanguageResponse(
        SalCode: first.SalCode,
        SalName: first.SalName,
        StateName: first.StateName,
        GccsaName: first.GccsaName,
        Sa2Code: first.Sa2Code,
        Sa2Name: first.Sa2Name,
        Y2011: ToYearData(byYear, 2011),
        Y2016: ToYearData(byYear, 2016),
        Y2021: ToYearData(byYear, 2021),
        DataNote: $"Language data is based on the ABS SA2 '{first.Sa2Name}', which may include nearby suburbs."
    ));
});

app.MapGet("/api/suburbs/{salCode}/birthcountry", async (IDbConnection db, string salCode) =>
  {
      var rows = await db.QueryAsync<BirthCountryRow>(@"
          SELECT
              sal_code AS SalCode, sal_name AS SalName,
              state_name AS StateName, gccsa_name AS GccsaName,
              sa2_code AS Sa2Code, sa2_name AS Sa2Name,
              census_year AS CensusYear, total_persons AS TotalPersons,
              australia_pct AS AustraliaPct, china_pct AS ChinaPct,
              india_pct AS IndiaPct, new_zealand_pct AS NewZealandPct,
              philippines_pct AS PhilippinesPct, vietnam_pct AS VietnamPct,
              uk_pct AS UkPct, south_africa_pct AS SouthAfricaPct,
              malaysia_pct AS MalaysiaPct, south_korea_pct AS SouthKoreaPct,
              italy_pct AS ItalyPct, sri_lanka_pct AS SriLankaPct,
              nepal_pct AS NepalPct, pakistan_pct AS PakistanPct,
              hong_kong_pct AS HongKongPct, usa_pct AS UsaPct,
              lebanon_pct AS LebanonPct, iraq_pct AS IraqPct,
              germany_pct AS GermanyPct, indonesia_pct AS IndonesiaPct,
              bangladesh_pct AS BangladeshPct, afghanistan_pct AS AfghanistanPct,
              greece_pct AS GreecePct, egypt_pct AS EgyptPct,
              fiji_pct AS FijiPct, croatia_pct AS CroatiaPct,
              ireland_pct AS IrelandPct, japan_pct AS JapanPct,
              netherlands_pct AS NetherlandsPct, poland_pct AS PolandPct,
              singapore_pct AS SingaporePct, taiwan_pct AS TaiwanPct,
              thailand_pct AS ThailandPct, canada_pct AS CanadaPct,
              born_elsewhere_pct AS BornElsewherePct
          FROM v_birthcountry_profile
          WHERE sal_code = @salCode
          ORDER BY census_year",
          new { salCode });

      var rowList = rows.ToList();
      if (rowList.Count == 0)
          return Results.NotFound(new { error = $"Suburb not found: {salCode}" });

      var first = rowList[0];
      var byYear = rowList.ToDictionary(r => r.CensusYear);

      static BirthCountryYearData? ToYearData(Dictionary<short, BirthCountryRow> d, short year)
      {
          if (!d.TryGetValue(year, out var r)) return null;
          var entries = new[]
          {
              new CountryEntry("Australia",    r.AustraliaPct),
              new CountryEntry("China",        r.ChinaPct),
              new CountryEntry("India",        r.IndiaPct),
              new CountryEntry("New Zealand",  r.NewZealandPct),
              new CountryEntry("Philippines",  r.PhilippinesPct),
              new CountryEntry("Vietnam",      r.VietnamPct),
              new CountryEntry("UK",           r.UkPct),
              new CountryEntry("South Africa", r.SouthAfricaPct),
              new CountryEntry("Malaysia",     r.MalaysiaPct),
              new CountryEntry("South Korea",  r.SouthKoreaPct),
              new CountryEntry("Italy",        r.ItalyPct),
              new CountryEntry("Sri Lanka",    r.SriLankaPct),
              new CountryEntry("Nepal",        r.NepalPct),
              new CountryEntry("Pakistan",     r.PakistanPct),
              new CountryEntry("Hong Kong",    r.HongKongPct),
              new CountryEntry("USA",          r.UsaPct),
              new CountryEntry("Lebanon",      r.LebanonPct),
              new CountryEntry("Iraq",         r.IraqPct),
              new CountryEntry("Germany",      r.GermanyPct),
              new CountryEntry("Indonesia",    r.IndonesiaPct),
              new CountryEntry("Bangladesh",   r.BangladeshPct),
              new CountryEntry("Afghanistan",  r.AfghanistanPct),
              new CountryEntry("Greece",       r.GreecePct),
              new CountryEntry("Egypt",        r.EgyptPct),
              new CountryEntry("Fiji",         r.FijiPct),
              new CountryEntry("Croatia",      r.CroatiaPct),
              new CountryEntry("Ireland",      r.IrelandPct),
              new CountryEntry("Japan",        r.JapanPct),
              new CountryEntry("Netherlands",  r.NetherlandsPct),
              new CountryEntry("Poland",       r.PolandPct),
              new CountryEntry("Singapore",    r.SingaporePct),
              new CountryEntry("Taiwan",       r.TaiwanPct),
              new CountryEntry("Thailand",     r.ThailandPct),
              new CountryEntry("Canada",       r.CanadaPct),
              new CountryEntry("Other",        r.BornElsewherePct),
          }
          .Where(e => e.Pct > 0)
          .OrderByDescending(e => e.Pct)
          .ToArray();
          return new BirthCountryYearData(r.TotalPersons, entries);
      }

      return Results.Ok(new BirthCountryResponse(
          SalCode: first.SalCode,
          SalName: first.SalName,
          StateName: first.StateName,
          GccsaName: first.GccsaName,
          Sa2Code: first.Sa2Code,
          Sa2Name: first.Sa2Name,
          Y2011: ToYearData(byYear, 2011),
          Y2016: ToYearData(byYear, 2016),
          Y2021: ToYearData(byYear, 2021),
          DataNote: $"Birth country data is based on the ABS SA2 '{first.Sa2Name}', which may include nearby suburbs."
      ));
  });

app.MapGet("/api/suburbs/{salCode}/education", async (IDbConnection db, string salCode) =>
{
    var rows = await db.QueryAsync<EducationRow>(@"
        SELECT
            sal_code AS SalCode, sal_name AS SalName,
            state_name AS StateName, gccsa_name AS GccsaName,
            sa2_code AS Sa2Code, sa2_name AS Sa2Name,
            census_year AS CensusYear, total_persons AS TotalPersons,
            postgrad_deg_pct  AS PostgradDegPct,
            grad_dip_cert_pct AS GradDipCertPct,
            bach_deg_pct      AS BachDegPct,
            adv_dip_dip_pct   AS AdvDipDipPct,
            cert_iii_iv_pct   AS CertIIIIVPct,
            cert_i_ii_pct     AS CertIIIPct,
            university_pct    AS UniversityPct
        FROM v_education_profile
        WHERE sal_code = @salCode
        ORDER BY census_year",
        new { salCode });

    var rowList = rows.ToList();
    if (rowList.Count == 0)
        return Results.NotFound(new { error = $"Suburb not found: {salCode}" });

    var first = rowList[0];
    var byYear = rowList.ToDictionary(r => r.CensusYear);

    static EducationYearData? ToYearData(Dictionary<short, EducationRow> d, short year)
    {
        if (!d.TryGetValue(year, out var r)) return null;
        var levels = new[]
        {
            new EducationLevel("Postgraduate",          r.PostgradDegPct),
            new EducationLevel("Grad Diploma/Cert",     r.GradDipCertPct),
            new EducationLevel("Bachelor Degree",       r.BachDegPct),
            new EducationLevel("Adv Diploma/Diploma",   r.AdvDipDipPct),
            new EducationLevel("Certificate III/IV",    r.CertIIIIVPct),
            new EducationLevel("Certificate I/II",      r.CertIIIPct),
        };
        return new EducationYearData(r.TotalPersons, r.UniversityPct, levels);
    }

    return Results.Ok(new EducationResponse(
        SalCode: first.SalCode,
        SalName: first.SalName,
        StateName: first.StateName,
        GccsaName: first.GccsaName,
        Sa2Code: first.Sa2Code,
        Sa2Name: first.Sa2Name,
        Y2011: ToYearData(byYear, 2011),
        Y2016: ToYearData(byYear, 2016),
        Y2021: ToYearData(byYear, 2021),
        DataNote: $"Education data is based on the ABS SA2 '{first.Sa2Name}', which may include nearby suburbs."
    ));
});

// heatmap
app.MapGet("/api/suburbs/heatmap", async (IDbConnection db, string? city) =>
{
    // city: "sydney" | "melbourne" | null (both)
    var gccsaFilter = city?.ToLower() switch
    {
        "sydney" => new[] { "1GSYD" },
        "melbourne" => new[] { "2GMEL" },
        _ => new[] { "1GSYD", "2GMEL" }
    };

    var rows = await db.QueryAsync<HeatmapRow>(@"
        SELECT
            s.sal_code          AS SalCode,
            s.sal_name          AS SalName,
            s.gccsa_code        AS GccsaCode,
            s.gccsa_name        AS GccsaName,
            s.state_name        AS StateName,
            t.residency_shift_index AS ResidencyShiftIndex,
            t.trend_label       AS TrendLabel,
            ST_AsGeoJSON(
                ST_Simplify(s.geom::geometry, 0.001)
            )                   AS GeometryJson
        FROM geo_sal s
        LEFT JOIN v_tenure_shift t ON t.sal_code = s.sal_code
        WHERE s.gccsa_code = ANY(@gccsaFilter)
          AND s.geom IS NOT NULL",
        new { gccsaFilter });

    var features = rows.Select(r => $$"""
        {
          "type": "Feature",
          "properties": {
            "salCode":              "{{r.SalCode}}",
            "salName":              "{{r.SalName.Replace("\"", "\\\"")}}",
            "gccsaCode":            "{{r.GccsaCode}}",
            "stateName":            "{{r.StateName}}",
            "residencyShiftIndex":  {{(r.ResidencyShiftIndex.HasValue ? r.ResidencyShiftIndex.Value.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) : "null")}},
            "trendLabel":           "{{r.TrendLabel ?? ""}}"
          },
          "geometry": {{r.GeometryJson}}
        }
        """);

    var geojson = $$"""
        {
          "type": "FeatureCollection",
          "features": [{{string.Join(",", features)}}]
        }
        """;

    return Results.Content(geojson, "application/json");
});

app.Run();

// ── DTOs ─────────────────────────────────────────────────────────────────────

record HeatmapRow(
    string SalCode, string SalName, string GccsaCode, string GccsaName, string StateName,
    decimal? ResidencyShiftIndex, string? TrendLabel, string GeometryJson);

record SuburbSearchResult(string SalCode, string SalName, string StateName, string GccsaName);

// Flat record Dapper maps directly from v_tenure_shift columns
record TenureRow(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    decimal? Outright2011, decimal? Outright2016, decimal? Outright2021,
    decimal? Mortgage2011, decimal? Mortgage2016, decimal? Mortgage2021,
    decimal? Rent2011, decimal? Rent2016, decimal? Rent2021,
    int? TotalDwellings2011, int? TotalDwellings2016, int? TotalDwellings2021,
    decimal? ResidencyShiftIndex, string TrendLabel);

// Nested response the frontend receives
record TenureResponse(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    TenureByYear Tenure,
    decimal? ResidencyShiftIndex, string TrendLabel, string DataNote);

record TenureByYear(YearValues Outright, YearValues Mortgage, YearValues Rent, YearCounts TotalDwellings);

record YearValues(decimal? Y2011, decimal? Y2016, decimal? Y2021);
record YearCounts(int? Y2011, int? Y2016, int? Y2021);

record NearbySuburbResult(
    string SalCode,
    string SalName,
    string StateName,
    string GccsaName,
    int DistanceMeters
);

record LanguageEntry(string Language, decimal? Pct);
record LanguageYearData(int? TotalPersons, LanguageEntry[] Languages);

record LanguageResponse(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    LanguageYearData? Y2011, LanguageYearData? Y2016, LanguageYearData? Y2021,
    string DataNote
);

record LanguageRow(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name, short CensusYear, int? TotalPersons,
    decimal? EnglishOnlyPct, decimal? ArabicPct, decimal? AusIndigenousPct, decimal? BengaliPct,
    decimal? CantonesePct, decimal? MandarinPct, decimal? ChineseOtherPct, decimal? ChineseTotalPct,
    decimal? CroatianPct, decimal? FilipinosPct, decimal? FrenchPct, decimal? GermanPct,
    decimal? GreekPct, decimal? GujaratiPct, decimal? HindiPct, decimal? IndonesianPct,
    decimal? ItalianPct, decimal? JapanesePct, decimal? KoreanPct, decimal? MacedonianPct,
    decimal? MalayalamPct, decimal? NepaliPct, decimal? PersianDariPct, decimal? PortuguesePct,
    decimal? PunjabiPct, decimal? RussianPct, decimal? SerbianPct, decimal? SinhalesePct,
    decimal? SpanishPct, decimal? TagalogPct, decimal? TamilPct, decimal? ThaiPct,
    decimal? TurkishPct, decimal? UrduPct, decimal? VietnamesePct, decimal? OtherLanguagePct
);

record CountryEntry(string Country, decimal? Pct);
record BirthCountryYearData(int? TotalPersons, CountryEntry[] Countries);

record BirthCountryResponse(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    BirthCountryYearData? Y2011, BirthCountryYearData? Y2016, BirthCountryYearData? Y2021,
    string DataNote
);

record BirthCountryRow(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name, short CensusYear, int? TotalPersons,
    decimal? AustraliaPct, decimal? ChinaPct, decimal? IndiaPct, decimal? NewZealandPct,
    decimal? PhilippinesPct, decimal? VietnamPct, decimal? UkPct, decimal? SouthAfricaPct,
    decimal? MalaysiaPct, decimal? SouthKoreaPct, decimal? ItalyPct, decimal? SriLankaPct,
    decimal? NepalPct, decimal? PakistanPct, decimal? HongKongPct, decimal? UsaPct,
    decimal? LebanonPct, decimal? IraqPct, decimal? GermanyPct, decimal? IndonesiaPct,
    decimal? BangladeshPct, decimal? AfghanistanPct, decimal? GreecePct, decimal? EgyptPct,
    decimal? FijiPct, decimal? CroatiaPct, decimal? IrelandPct, decimal? JapanPct,
    decimal? NetherlandsPct, decimal? PolandPct, decimal? SingaporePct, decimal? TaiwanPct,
    decimal? ThailandPct, decimal? CanadaPct, decimal? BornElsewherePct
);

record EducationLevel(string Label, decimal? Pct);
record EducationYearData(int? TotalPersons, decimal? UniversityPct, EducationLevel[] Levels);

record EducationResponse(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    EducationYearData? Y2011, EducationYearData? Y2016, EducationYearData? Y2021,
    string DataNote
);

record EducationRow(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name, short CensusYear, int? TotalPersons,
    decimal? PostgradDegPct, decimal? GradDipCertPct, decimal? BachDegPct,
    decimal? AdvDipDipPct, decimal? CertIIIIVPct, decimal? CertIIIPct,
    decimal? UniversityPct
);

