import { Database, MessageSquare } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

export function Layout() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b">
				<div className="container flex h-16 items-center px-4">
					<div className="mr-8 font-bold text-xl">S3 & SQS UI</div>
					<nav className="flex items-center space-x-6 text-sm font-medium">
						<Link to="/s3" className="flex items-center gap-2 hover:text-primary">
							<Database className="h-4 w-4" />
							S3
						</Link>
						<Link to="/sqs" className="flex items-center gap-2 hover:text-primary">
							<MessageSquare className="h-4 w-4" />
							SQS
						</Link>
					</nav>
				</div>
			</header>
			<main className="flex-1 container py-6">
				<Outlet />
			</main>
		</div>
	);
}
