import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { BucketList } from "@/pages/BucketList";
import { MessageList } from "@/pages/MessageList";
import { ObjectBrowser } from "@/pages/ObjectBrowser";
import { QueueList } from "@/pages/QueueList";
import { type AppConfig, activeProfile, findProfile } from "@/types/config";

interface RouterContext {
  // Populated by RouterProvider from ConfigContext; null while loading.
  config: AppConfig | null;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
});

/** The landing route for a profile: S3 when it has it, otherwise SQS. */
function landing(config: AppConfig, profileId: string) {
  const profile = findProfile(config, profileId);
  if (profile?.sqs && !profile.s3) return { to: "/$profile/sqs", params: { profile: profileId } } as const;
  return { to: "/$profile/s3", params: { profile: profileId } } as const;
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    const { config } = context;
    if (!config) return; // still loading — Layout renders its loading state
    const profile = activeProfile(config, undefined);
    if (profile) throw redirect(landing(config, profile.id));
  },
  component: () => null,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$profile",
  beforeLoad: ({ context, params }) => {
    const { config } = context;
    if (!config) return;
    // A stale bookmark or a removed profile lands on the default rather than 404ing.
    if (!findProfile(config, params.profile)) {
      const fallback = activeProfile(config, undefined);
      if (fallback) throw redirect(landing(config, fallback.id));
    }
  },
  component: () => <Outlet />,
});

/**
 * Redirects to the other service when this one is disabled for the active profile.
 * Kept as a plain call rather than a `beforeLoad` factory: annotating `params` in a
 * factory's signature would drive route inference and erase the child's own params.
 */
function guardService(config: AppConfig | null, profileId: string, service: "s3" | "sqs") {
  if (!config) return;
  const profile = findProfile(config, profileId);
  if (!profile || profile[service]) return;
  if (service === "s3" && profile.sqs) throw redirect({ to: "/$profile/sqs", params: { profile: profileId } });
  if (service === "sqs" && profile.s3) throw redirect({ to: "/$profile/s3", params: { profile: profileId } });
}

const bucketsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/s3",
  beforeLoad: ({ context, params }) => guardService(context.config, params.profile, "s3"),
  component: BucketList,
});

const objectBrowserRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/s3/$bucket",
  validateSearch: (search: Record<string, unknown>): { prefix: string } => ({
    prefix: typeof search.prefix === "string" ? search.prefix : "",
  }),
  beforeLoad: ({ context, params }) => guardService(context.config, params.profile, "s3"),
  component: ObjectBrowser,
});

const queuesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/sqs",
  beforeLoad: ({ context, params }) => guardService(context.config, params.profile, "sqs"),
  component: QueueList,
});

const messagesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/sqs/$queueName",
  beforeLoad: ({ context, params }) => guardService(context.config, params.profile, "sqs"),
  component: MessageList,
});

/**
 * Pre-profile URLs stay valid. Static segments outrank `$profile`, so these win for
 * `/s3/...` and `/sqs/...` and hand over to the default profile.
 */
function defaultProfileId(config: AppConfig | null): string | undefined {
  return activeProfile(config, undefined)?.id;
}

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
  validateSearch: (search: Record<string, unknown>): { prefix: string } => ({
    prefix: typeof search.prefix === "string" ? search.prefix : "",
  }),
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
  profileRoute.addChildren([bucketsRoute, objectBrowserRoute, queuesRoute, messagesRoute]),
]);

export const router = createRouter({
  routeTree,
  context: { config: null },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
