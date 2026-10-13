import type { AppConfig } from "@api/schema/config";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { configQuery } from "@/hooks/useConfig";
import { queryClient } from "@/lib/query-client";
import { BucketList } from "@/pages/BucketList";
import { MessageList } from "@/pages/MessageList";
import { ObjectBrowser } from "@/pages/ObjectBrowser";
import { QueueList } from "@/pages/QueueList";
import { activeProfile, findProfile } from "@/types/config";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ context }) => ({ config: await context.queryClient.ensureQueryData(configQuery) }),
  pendingComponent: () => <div className="flex h-screen items-center justify-center">Loading...</div>,
  component: Layout,
});

function landing(config: AppConfig, profileId: string) {
  const profile = findProfile(config, profileId);
  if (profile?.sqs && !profile.s3) return { to: "/$profile/sqs", params: { profile: profileId } } as const;
  return { to: "/$profile/s3", params: { profile: profileId } } as const;
}

function defaultProfileId(config: AppConfig): string | undefined {
  return activeProfile(config, undefined)?.id;
}

function prefixSearch(search: Record<string, unknown>): { prefix: string } {
  return { prefix: typeof search.prefix === "string" ? search.prefix : "" };
}

function guardService(config: AppConfig, profileId: string, service: "s3" | "sqs") {
  const profile = findProfile(config, profileId);
  if (!profile || profile[service]) return;
  if (service === "s3" && profile.sqs) throw redirect({ to: "/$profile/sqs", params: { profile: profileId } });
  if (service === "sqs" && profile.s3) throw redirect({ to: "/$profile/s3", params: { profile: profileId } });
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    const profile = defaultProfileId(context.config);
    if (profile) throw redirect(landing(context.config, profile));
  },
  component: () => null,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$profile",
  beforeLoad: ({ context, params }) => {
    if (findProfile(context.config, params.profile)) return;
    const fallback = defaultProfileId(context.config);
    if (fallback) throw redirect(landing(context.config, fallback));
  },
});

const s3Route = createRoute({
  getParentRoute: () => profileRoute,
  path: "/s3",
  beforeLoad: ({ context, params }) => guardService(context.config, params.profile, "s3"),
});

const bucketsRoute = createRoute({
  getParentRoute: () => s3Route,
  path: "/",
  component: BucketList,
});

const objectBrowserRoute = createRoute({
  getParentRoute: () => s3Route,
  path: "/$bucket",
  validateSearch: prefixSearch,
  remountDeps: ({ params, search }) => ({ ...params, prefix: search.prefix }),
  component: ObjectBrowser,
});

const sqsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/sqs",
  beforeLoad: ({ context, params }) => guardService(context.config, params.profile, "sqs"),
});

const queuesRoute = createRoute({
  getParentRoute: () => sqsRoute,
  path: "/",
  component: QueueList,
});

const messagesRoute = createRoute({
  getParentRoute: () => sqsRoute,
  path: "/$queueName",
  component: MessageList,
});

const legacyBucketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/s3",
  beforeLoad: ({ context }) => {
    const profile = defaultProfileId(context.config);
    if (profile) throw redirect({ to: "/$profile/s3", params: { profile } });
  },
  component: () => null,
});

const legacyObjectBrowserRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/s3/$bucket",
  validateSearch: prefixSearch,
  beforeLoad: ({ context, params, search }) => {
    const profile = defaultProfileId(context.config);
    if (profile) {
      throw redirect({ to: "/$profile/s3/$bucket", params: { profile, bucket: params.bucket }, search });
    }
  },
  component: () => null,
});

const legacyQueuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sqs",
  beforeLoad: ({ context }) => {
    const profile = defaultProfileId(context.config);
    if (profile) throw redirect({ to: "/$profile/sqs", params: { profile } });
  },
  component: () => null,
});

const legacyMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sqs/$queueName",
  beforeLoad: ({ context, params }) => {
    const profile = defaultProfileId(context.config);
    if (profile) {
      throw redirect({ to: "/$profile/sqs/$queueName", params: { profile, queueName: params.queueName } });
    }
  },
  component: () => null,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  legacyBucketsRoute,
  legacyObjectBrowserRoute,
  legacyQueuesRoute,
  legacyMessagesRoute,
  profileRoute.addChildren([
    s3Route.addChildren([bucketsRoute, objectBrowserRoute]),
    sqsRoute.addChildren([queuesRoute, messagesRoute]),
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
