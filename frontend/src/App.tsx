import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { useConfig } from "@/contexts/ConfigContext";
import { BucketList } from "@/pages/BucketList";
import { MessageList } from "@/pages/MessageList";
import { ObjectBrowser } from "@/pages/ObjectBrowser";
import { QueueList } from "@/pages/QueueList";

function AppRoutes() {
  const { config, isLoading } = useConfig();

  if (isLoading) return null;

  const defaultRoute = config?.s3 ? "/s3" : config?.sqs ? "/sqs" : "/";

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {config?.s3 && (
          <>
            <Route path="s3" element={<BucketList />} />
            <Route path="s3/:bucket" element={<ObjectBrowser />} />
          </>
        )}
        {config?.sqs && (
          <>
            <Route path="sqs" element={<QueueList />} />
            <Route path="sqs/:queueName" element={<MessageList />} />
          </>
        )}
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
