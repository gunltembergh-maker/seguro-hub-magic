import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { LoadingSplash } from "./components/loading-splash";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Query controla freshness; preload no hover não refaz se estiver fresco
    defaultPreloadStaleTime: 30_000,
    defaultPendingComponent: LoadingSplash,
    defaultPendingMs: 200,
  });

  return router;
};

