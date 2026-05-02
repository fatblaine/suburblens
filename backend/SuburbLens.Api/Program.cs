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

// Npgsql — connection left closed; Dapper opens/closes per query
builder.Services.AddScoped<IDbConnection>(_ =>
{
    var connStr = builder.Configuration["SUPABASE_DB_URL"]
        ?? Environment.GetEnvironmentVariable("SUPABASE_DB_URL")
        ?? throw new InvalidOperationException("SUPABASE_DB_URL not set");
    return new NpgsqlConnection(connStr);
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(p => p
        .WithOrigins(
            "http://localhost:5173",
            "https://suburblens.vercel.app"
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

app.MapGet("/api/suburbs/search", async (IDbConnection db, string q) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
        return Results.BadRequest(new { error = "Query must be at least 2 characters" });

    var results = await db.QueryAsync<SuburbSearchResult>(@"
        SELECT sal_code AS SalCode, sal_name AS SalName,
               state_name AS StateName, gccsa_name AS GccsaName
        FROM geo_sal
        WHERE sal_name ILIKE @pattern
          AND gccsa_code IN ('1GSYD', '2GMEL')
        ORDER BY sal_name
        LIMIT 10", new { pattern = $"%{q}%" });

    return Results.Ok(results);
});

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
            Rent:     new YearValues(row.Rent2011,     row.Rent2016,     row.Rent2021)
        ),
        ResidencyShiftIndex: row.ResidencyShiftIndex,
        TrendLabel: row.TrendLabel,
        DataNote: $"Cross-year data is based on the ABS SA2 '{row.Sa2Name}', which may include nearby suburbs."
    );

    return Results.Ok(response);
});

app.Run();

// ── DTOs ─────────────────────────────────────────────────────────────────────

record SuburbSearchResult(string SalCode, string SalName, string StateName, string GccsaName);

// Flat record Dapper maps directly from v_tenure_shift columns
record TenureRow(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    decimal? Outright2011, decimal? Outright2016, decimal? Outright2021,
    decimal? Mortgage2011, decimal? Mortgage2016, decimal? Mortgage2021,
    decimal? Rent2011,     decimal? Rent2016,     decimal? Rent2021,
    decimal? ResidencyShiftIndex, string TrendLabel);

// Nested response the frontend receives
record TenureResponse(
    string SalCode, string SalName, string StateName, string GccsaName,
    string Sa2Code, string Sa2Name,
    TenureByYear Tenure,
    decimal? ResidencyShiftIndex, string TrendLabel, string DataNote);

record TenureByYear(YearValues Outright, YearValues Mortgage, YearValues Rent);

record YearValues(decimal? Y2011, decimal? Y2016, decimal? Y2021);
