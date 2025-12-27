import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { BucketList } from "@/pages/BucketList";
import { ObjectBrowser } from "@/pages/ObjectBrowser";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/s3" replace />} />
          <Route path="s3" element={<BucketList />} />
          <Route path="s3/:bucket" element={<ObjectBrowser />} />
          <Route path="sqs" element={<div>SQS Placeholder</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
