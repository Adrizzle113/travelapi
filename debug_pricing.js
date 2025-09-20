// Test to debug why all rooms have the same price
const ratehawkSearchService = require("./services/ratehawkSearchService");

async function debugRoomPricing() {
  console.log("🔍 DEBUGGING ROOM PRICING ISSUE...");

  const searchParams = {
    destination: "Las Vegas", // Try a different destination that might have more price variation
    checkIn: "2025-08-01",
    checkOut: "2025-08-02",
    adults: 2,
    children: 0,
    rooms: 1,
  };

  try {
    const results = await ratehawkSearchService.searchHotels(searchParams);

    if (results && results.hotels && results.hotels.length > 0) {
      console.log(`\n📊 FOUND ${results.hotels.length} HOTELS`);

      // Look at first hotel with multiple room groups
      for (let i = 0; i < Math.min(3, results.hotels.length); i++) {
        const hotel = results.hotels[i];
        console.log(`\n🏨 Hotel ${i + 1}: ${hotel.name}`);

        if (
          hotel.roomGroupsWithPricing &&
          hotel.roomGroupsWithPricing.length > 1
        ) {
          console.log(
            `💰 FOUND MULTIPLE ROOM GROUPS (${hotel.roomGroupsWithPricing.length}):`
          );

          hotel.roomGroupsWithPricing.forEach((group, idx) => {
            console.log(`  ${idx + 1}. ${group.roomType}`);
            console.log(
              `     Price: ${group.price || "N/A"} ${group.currency || "USD"}`
            );
            console.log(
              `     Rate Amount: ${group.rates?.[0]?.amount || "N/A"}`
            );
            console.log(`     Group ID: ${group.groupId}`);
            console.log(`     Has Pricing: ${group.hasPricing}`);
          });

          // Check if all prices are the same
          const prices = hotel.roomGroupsWithPricing.map((g) =>
            parseFloat(g.price || g.rates?.[0]?.amount || 0)
          );
          const uniquePrices = [...new Set(prices)];

          console.log(`\n📈 PRICE ANALYSIS:`);
          console.log(`   All Prices: [${prices.join(", ")}]`);
          console.log(`   Unique Prices: [${uniquePrices.join(", ")}]`);
          console.log(
            `   Price Variation: ${
              uniquePrices.length > 1 ? "YES" : "NO - ALL SAME!"
            }`
          );

          if (uniquePrices.length === 1) {
            console.log(
              `⚠️  ISSUE CONFIRMED: All ${hotel.roomGroupsWithPricing.length} room types have the same price: $${uniquePrices[0]}`
            );
          }

          break;
        }
      }
    } else {
      console.log("❌ No hotels found");
    }
  } catch (error) {
    console.error("💥 Debug failed:", error);
  }
}

debugRoomPricing().catch(console.error);
