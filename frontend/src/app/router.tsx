import { createBrowserRouter } from "react-router";

import { About } from "../pages/About";
import { Discover } from "../pages/Discover";
import { Explore } from "../pages/Explore";
import { Landing } from "../pages/Landing";
import { NotFound } from "../pages/NotFound";
import { Layout } from "./Layout";
import { RouteError } from "./RouteError";

export const routes = [
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
