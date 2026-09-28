import { createBrowserRouter } from "react-router";

import { About } from "../pages/About";
import { Discover } from "../pages/Discover";
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
      // The viewer (canvas, plots, comparisons) is most of the code; load it when first needed.
      { path: "explore", lazy: async () => ({ Component: (await import("../pages/Explore")).Explore }) },
      { path: "discover", element: <Discover /> },
      { path: "about", element: <About /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
