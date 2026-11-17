import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { LoginPage } from "@/pages/auth/LoginPage";
import { CommunityPage } from "@/pages/community/CommunityPage";
import { DisclosurePage } from "@/pages/community/DisclosurePage";
import { PostPage } from "@/pages/community/PostPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { MyPage } from "@/pages/me/MyPage";
import { UiCatalogPage } from "@/pages/dev/UiCatalogPage";
import { NotReadyPage } from "@/pages/not-ready/NotReadyPage";
import { TradePage } from "@/pages/trade/TradePage";
import { ApiError } from "@/shared/api/errors";
import { sessionKey } from "@/shared/api/queryKeys";
import type { RealtimeClient } from "@/shared/realtime/RealtimeClient";
import { RealtimeProvider } from "@/shared/realtime/RealtimeProvider";
import { ToastViewport } from "@/shared/ui/Toast";
import { AppLayout } from "./layout/AppLayout";

function buildRoutes(realtime: RealtimeClient): RouteObject[] {
  return [
    { path: "login", element: <LoginPage /> },
    { path: "signup", element: <SignupPage /> },
    {
      // 실시간 연결은 로그인한 뒤에만 연다. 로그아웃하면 이 트리가 내려가면서 연결도 끊긴다
      element: (
        <RequireAuth>
          <RealtimeProvider client={realtime}>
            <AppLayout />
          </RealtimeProvider>
        </RequireAuth>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: "trade/:code?", element: <TradePage /> },
        { path: "community/:code?", element: <CommunityPage /> },
        { path: "posts/:id", element: <PostPage /> },
        { path: "disclosures/:id", element: <DisclosurePage /> },
        { path: "notifications", element: <NotificationsPage /> },
        { path: "arcade", element: <NotReadyPage name="오락실" /> },
        { path: "me", element: <MyPage /> },
        ...(import.meta.env.DEV ? [{ path: "dev/ui", element: <UiCatalogPage /> }] : []),
        { path: "*", element: <NotReadyPage name="요청한" /> },
      ],
    },
  ];
}

function createQueryClient() {
  // 어떤 요청이든 401이면 세션이 끝난 것이다. 로그아웃 상태로 바꾸면 RequireAuth가 로그인으로 보낸다
  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401 && client.getQueryData(sessionKey) !== null) {
      client.setQueryData(sessionKey, null);
    }
  };
  const client = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchOnWindowFocus: true,
        // 4xx는 다시 시도해도 결과가 같다. 네트워크·5xx만 2번 재시도
        retry: (count, err) => (err instanceof ApiError && err.status >= 400 && err.status < 500 ? false : count < 2),
      },
      mutations: { retry: false },
    },
  });
  return client;
}

export function App({ realtime }: { realtime: RealtimeClient }) {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(buildRoutes(realtime)));
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastViewport />
    </QueryClientProvider>
  );
}
