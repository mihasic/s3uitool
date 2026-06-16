import { createRootRouteWithContext, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { BucketList } from "@/pages/BucketList";
import { MessageList } from "@/pages/MessageList";
import { ObjectBrowser } from "@/pages/ObjectBrowser";
import { QueueList } from "@/pages/QueueList";
import type { AppConfig } from "@/types/config";

interface RouterContext {
  // Populated by RouterProvider from ConfigContext; null while loading.
  config: AppConfig | null;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    const { config } = context;
    if (!config) return; // still loading — Layout renders its loading state
    if (config.s3) throw redirect({ to: "/s3" });
    if (config.sqs) throw redirect({ to: "/sqs" });
  },
  component: () => null,
});

const bucketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/s3",
  beforeLoad: ({ context }) => {
    if (context.config && !context.config.s3) {
      throw redirect({ to: context.config.sqs ? "/sqs" : "/" });
    }
  },
  component: BucketList,
});

const objectBrowserRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/s3/$bucket",
  validateSearch: (search: Record<string, unknown>): { prefix: string } => ({
    prefix: typeof search.prefix === "string" ? search.prefix : "",
  }),
  beforeLoad: ({ context }) => {
    if (context.config && !context.config.s3) {
      throw redirect({ to: context.config.sqs ? "/sqs" : "/" });
    }
  },
  component: ObjectBrowser,
});

const queuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sqs",
  beforeLoad: ({ context }) => {
    if (context.config && !context.config.sqs) {
      throw redirect({ to: context.config.s3 ? "/s3" : "/" });
    }
  },
  component: QueueList,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sqs/$queueName",
  beforeLoad: ({ context }) => {
    if (context.config && !context.config.sqs) {
      throw redirect({ to: context.config.s3 ? "/s3" : "/" });
    }
  },
  component: MessageList,
});

const routeTree = rootRoute.addChildren([indexRoute, bucketsRoute, objectBrowserRoute, queuesRoute, messagesRoute]);

export const router = createRouter({
  routeTree,
  context: { config: null },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
