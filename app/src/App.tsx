import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { router } from "@/router";

function App() {
  return (
    <>
      <Toaster />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
