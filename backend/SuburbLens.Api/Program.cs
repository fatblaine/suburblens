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

var app = builder.Build();
app.UseCors();

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
    var result = await db.QuerySingleOrDefaultAsync<TenureData>(@"
        SELECT
            sal_code AS SalCode, sal_name AS SalName,
            sa2_code AS Sa2Code, sa2_name AS Sa2Name,
            outright_2011 AS Outright2011, outright_2016 AS Outright2016, outright_2021 AS Outright2021,
            mortgage_2011 AS Mortgage2011, mortgage_2016 AS Mortgage2016, mortgage_2021 AS Mortgage2021,
            rent_2011 AS Rent2011, rent_2016 AS Rent2016, rent_2021 AS Rent2021,
            residency_shift_index AS ResidencyShiftIndex, trend_label AS TrendLabel
        FROM v_tenure_shift
        WHERE sal_code = @salCode",
        new { salCode });

    return result is null
        ? Results.NotFound(new { error = $"Suburb not found: {salCode}" })
        : Results.Ok(result);
});

app.Run();

// DTOs
record SuburbSearchResult(string SalCode, string SalName, string StateName, string GccsaName);

record TenureData(
    string SalCode, string SalName, string Sa2Code, string Sa2Name,
    decimal Outright2011, decimal Outright2016, decimal Outright2021,
    decimal Mortgage2011, decimal Mortgage2016, decimal Mortgage2021,
    decimal Rent2011, decimal Rent2016, decimal Rent2021,
    decimal ResidencyShiftIndex, string TrendLabel);
