using Dapper;
using Npgsql;
using System.Data;

var builder = WebApplication.CreateBuilder(args);

// Lambda hosting 
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Npgsql
builder.Services.AddScoped<IDbConnection>(_ =>
{
    var connStr = Environment.GetEnvironmentVariable("SUPABASE_DB_URL")
        ?? throw new InvalidOperationException("SUPABASE_DB_URL not set");
    var conn = new NpgsqlConnection(connStr);
    conn.Open();
    return conn;
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

    var results = await db.QueryAsync(@"
        SELECT sal_code, sal_name, state_name, gccsa_name
        FROM geo_sal
        WHERE sal_name_lower ILIKE @pattern
          AND gccsa_code IN ('1GSYD', '2GMEL')
        ORDER BY sal_name
        LIMIT 10", new { pattern = $"%{q.ToLower()}%" });

    return Results.Ok(results);
});

app.MapGet("/api/suburbs/{salCode}/tenure", async (IDbConnection db, string salCode) =>
{
    var result = await db.QuerySingleOrDefaultAsync(@"
        SELECT 
            sal_code, sal_name, sa2_code, sa2_name,
            outright_2011, outright_2016, outright_2021,
            mortgage_2011, mortgage_2016, mortgage_2021,
            rent_2011, rent_2016, rent_2021,
            residency_shift_index, trend_label
        FROM v_tenure_shift
        WHERE sal_code = @salCode",
        new { salCode });

    return result is null
        ? Results.NotFound(new { error = $"Suburb not found: {salCode}" })
        : Results.Ok(result);
});

app.Run();
