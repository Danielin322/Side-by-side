import "server-only";
import { END, START, StateGraph } from "@langchain/langgraph";
import { MatchingState } from "./state";
import { fallback, prepare, rank, routeAfterShortlist, routeAfterValidate, shortlist, validate } from "./nodes";

/**
 * Best match workflow:
 *
 *   START → prepare → shortlist ─(>8 candidates)→ rank (LLM) → validate ─ok→ END
 *                         └─(0–8 candidates or no key)→ fallback → END  ←─fail─┘
 */
export const matchingGraph = new StateGraph(MatchingState)
  .addNode("prepare", prepare)
  .addNode("shortlist", shortlist)
  .addNode("rank", rank)
  .addNode("validate", validate)
  .addNode("fallback", fallback)
  .addEdge(START, "prepare")
  .addEdge("prepare", "shortlist")
  .addConditionalEdges("shortlist", routeAfterShortlist, { rank: "rank", fallback: "fallback" })
  .addEdge("rank", "validate")
  .addConditionalEdges("validate", routeAfterValidate, { done: END, fallback: "fallback" })
  .addEdge("fallback", END)
  .compile();
