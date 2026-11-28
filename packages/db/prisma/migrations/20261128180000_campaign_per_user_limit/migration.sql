-- perUserLimit can be greater than one, so a buyer may redeem the same campaign more than once.
DROP INDEX "PromoRedemption_campaignId_userId_key";
DROP INDEX "PromoRedemption_campaignId_idx";
CREATE INDEX "PromoRedemption_campaignId_userId_idx" ON "PromoRedemption"("campaignId", "userId");
