namespace SuburbLens.Api.Tests;

// HeatmapScope.Resolve encodes a core project rule: only Sydney (1GSYD) and
// Melbourne (2GMEL) are in scope. These tests lock that rule in without a DB.
public class HeatmapScopeTests
{
    [Theory]
    [InlineData("sydney", "1GSYD")]
    [InlineData("Sydney", "1GSYD")]     // case-insensitive
    [InlineData("SYDNEY", "1GSYD")]
    [InlineData("melbourne", "2GMEL")]
    [InlineData("MELBOURNE", "2GMEL")]
    public void Resolve_maps_a_known_city_to_its_single_gccsa(string city, string expectedGccsa)
    {
        var (_, gccsa) = HeatmapScope.Resolve(city);
        Assert.Equal(new[] { expectedGccsa }, gccsa);
    }

    [Theory]
    [InlineData("sydney", "heatmap:v1:sydney")]
    [InlineData("melbourne", "heatmap:v1:melbourne")]
    public void Resolve_uses_a_city_specific_cache_key(string city, string expectedKey)
    {
        var (cacheKey, _) = HeatmapScope.Resolve(city);
        Assert.Equal(expectedKey, cacheKey);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("perth")]       // out of scope
    [InlineData("brisbane")]
    public void Resolve_falls_back_to_both_cities_when_absent_or_unknown(string? city)
    {
        var (cacheKey, gccsa) = HeatmapScope.Resolve(city);
        Assert.Equal("heatmap:v1:all", cacheKey);
        Assert.Equal(new[] { "1GSYD", "2GMEL" }, gccsa);
    }

    [Fact]
    public void Resolve_never_leaks_an_out_of_scope_gccsa_code()
    {
        string[] inScope = { "1GSYD", "2GMEL" };
        foreach (var city in new string?[] { "sydney", "melbourne", null, "perth" })
        {
            var (_, gccsa) = HeatmapScope.Resolve(city);
            Assert.All(gccsa, code => Assert.Contains(code, inScope));
        }
    }
}
