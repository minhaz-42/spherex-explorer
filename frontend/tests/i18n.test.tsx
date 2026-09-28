import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { LanguageToggle } from "../src/components/LanguageToggle";
import { currentLang, defineMessages, format, setLang, translate, useT } from "../src/lib/i18n";

const M = defineMessages({
  en: { hello: "Hello, {name}", frames: "{n} frames" },
  bn: { hello: "হ্যালো, {name}", frames: "{n}টি ফ্রেম" },
});

function Greeting() {
  const t = useT(M);
  return <p>{t("hello", { name: "SPHEREx" })}</p>;
}

afterEach(() => act(() => setLang("en")));

describe("i18n", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(format("{n} frames in {p} passes", { n: 361, p: 5 })).toBe("361 frames in 5 passes");
    expect(format("{n} frames", {})).toBe("{n} frames");
    expect(translate(M, "bn", "frames", { n: 19 })).toBe("19টি ফ্রেম");
  });

  it("switches every component, the page language and the saved choice together", async () => {
    render(
      <>
        <Greeting />
        <LanguageToggle />
      </>,
    );
    expect(screen.getByText("Hello, SPHEREx")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show the site in Bangla" }));
    expect(screen.getByText("হ্যালো, SPHEREx")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("bn");
    expect(currentLang()).toBe("bn");
    expect(localStorage.getItem("spherex-lang")).toBe("bn");
    await userEvent.click(screen.getByRole("button", { name: "Show the site in English" }));
    expect(screen.getByText("Hello, SPHEREx")).toBeInTheDocument();
  });
});
