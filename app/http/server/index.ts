import { addResponse } from "@/http/server/endpoints/add";
import { jsonifyResponse } from "@/helpers/jsonify";
import { removeResponse } from "@/http/server/endpoints/[mcpName]/remove";
import { listResponse } from "@/http/server/endpoints/list";
import { startMCPResponse } from "@/http/server/endpoints/[mcpName]/start";
import { stopResponse } from "@/http/server/endpoints/[mcpName]/stop";
import { statusResponse } from "@/http/server/endpoints/status";
import { restartResponse } from "@/http/server/endpoints/[mcpName]/restart";
import { callResponse } from "@/http/server/endpoints/[mcpName]/call";
import { singleStatusResponse } from "@/http/server/endpoints/[mcpName]/status";
import { singleToolsResponse } from "@/http/server/endpoints/[mcpName]/tools";
import { toolsResponse } from "@/http/server/endpoints/tools";
import {
  startAggregatorResponse,
  stopAggregatorResponse,
  restartAggregatorResponse,
  statusAggregatorResponse,
} from "@/http/server/endpoints/aggregator";

export {
  addResponse,
  jsonifyResponse,
  removeResponse,
  listResponse,
  startMCPResponse,
  stopResponse,
  statusResponse,
  restartResponse,
  callResponse,
  singleStatusResponse,
  singleToolsResponse,
  toolsResponse,
  startAggregatorResponse,
  stopAggregatorResponse,
  restartAggregatorResponse,
  statusAggregatorResponse,
};
