import { startMCPAggregatorServer } from "@/aggregator/start";
import { stopMCPAggregatorServer } from "@/aggregator/stop";
import { restartMCPAggregatorServer } from "@/aggregator/restart";
import aggregatorStatus from "@/aggregator/status";
import { connectMCPAggregatorServer } from "@/aggregator/connect";

export {
  startMCPAggregatorServer,
  stopMCPAggregatorServer,
  restartMCPAggregatorServer,
  aggregatorStatus,
  connectMCPAggregatorServer,
};
