import { hostnameFromUrl } from "./hostname";

describe("hostnameFromUrl", () => {
  it("extracts the hostname from a URL", () => {
    expect(hostnameFromUrl("https://www.acmebouncehouses.com/rentals?x=1")).toBe(
      "www.acmebouncehouses.com",
    );
    expect(hostnameFromUrl("http://example.com")).toBe("example.com");
  });

  it("extracts the hostname from a URL with a path and query string", () => {
    expect(hostnameFromUrl("https://example.com/path?q=1")).toBe("example.com");
  });

  it("extracts the hostname from a URL with a subdomain and port", () => {
    expect(hostnameFromUrl("http://sub.domain.co.uk:8080/foo")).toBe("sub.domain.co.uk");
  });

  it("falls back to the raw input for an unparseable URL", () => {
    expect(hostnameFromUrl("not-a-url")).toBe("not-a-url");
  });

  it("falls back to the raw input when it is not a valid URL", () => {
    expect(hostnameFromUrl("not a url")).toBe("not a url");
  });
});
