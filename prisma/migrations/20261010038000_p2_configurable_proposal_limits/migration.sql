DROP INDEX "opportunity_proposals_opportunity_id_proposer_id_key";
CREATE INDEX "opportunity_proposals_opportunity_id_proposer_id_idx" ON "opportunity_proposals"("opportunity_id", "proposer_id");
