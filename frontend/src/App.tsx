import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { BucketList } from "@/pages/BucketList";
import { MessageList } from "@/pages/MessageList";
import { ObjectBrowser } from "@/pages/ObjectBrowser";
import { QueueList } from "@/pages/QueueList";

function App() {
	return (
		<BrowserRouter>
			<Toaster />
			<Routes>
				<Route path="/" element={<Layout />}>
					<Route index element={<Navigate to="/s3" replace />} />
					<Route path="s3" element={<BucketList />} />
					<Route path="s3/:bucket" element={<ObjectBrowser />} />
					<Route path="sqs" element={<QueueList />} />
					<Route path="sqs/:queueName" element={<MessageList />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

export default App;
