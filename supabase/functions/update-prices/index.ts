import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },

    async () => {
      return Response.json({
        success: true,
        ticker: "NVDA",
        price: 123.45,
        source: "edge-function-test",
      });
    }
  ),
};