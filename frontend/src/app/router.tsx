import { createBrowserRouter } from "react-router";

import { About } from "../pages/About";
import { AskApp } from "../pages/AskApp";
import { Discover } from "../pages/Discover";
import { Explore } from "../pages/Explore";
import { Landing } from "../pages/Landing";
import { NotFound } from "../pages/NotFound";
import { Layout } from "./Layout";
import { RouteError } from "./RouteError";

export const routes = [
  // The assistant is a chat app of its own, outside the site's header and footer.
  { path: "/ask", element: <AskApp />, errorElement: <RouteError /> },
  { path: "/ask/:chatId", element: <AskApp />, errorElement: <RouteError /> },
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Landing /> },
      { path: "explore", element: <Explore /> },
      { path: "discover", element: <Discover /> },
      { path: "about", element: <About /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
