namespace SuburbLens.Api.Tests;

// GccsaScope is the single source of truth for the project scope rule: only
// Sydney (1GSYD) and Melbourne (2GMEL) are in scope, "both" when absent/unknown.
public class GccsaScopeTests
{
    [Theory]
    [InlineData("sydney", "1GSYD")]
    [InlineData("Sydney", "1GSYD")]     // case-insensitive
    [InlineData("MELBOURNE", "2GMEL")]
    public void For_maps_a_known_city_to_its_single_gccsa(string city, string expected)
    {
        Assert.Equal(new[] { expected }, GccsaScope.For(city));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("perth")]       // out of scope
    public void For_falls_back_to_both_cities_when_absent_or_unknown(string? city)
    {
        Assert.Equal(new[] { "1GSYD", "2GMEL" }, GccsaScope.For(city));
    }

    [Fact]
    public void All_is_exactly_the_two_in_scope_cities()
    {
        Assert.Equal(new[] { "1GSYD", "2GMEL" }, GccsaScope.All);
    }
}
