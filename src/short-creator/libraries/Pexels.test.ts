process.env.LOG_LEVEL = "debug";

import nock from "nock";
import { PexelsAPI } from "./Pexels";
import { test, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import { OrientationEnum } from "../../types/shorts";

// PexelsAPI fetches from the Pixabay API (see Pexels.ts). All requests are
// answered by nock; real network access is blocked, so no API key is needed.
const pixabayHost = "https://pixabay.com";
const searchPath = /^\/api\/videos\//;
const mockResponse = fs.readFileSync(
  path.resolve("__mocks__/pixabay-response.json"),
  "utf-8",
);

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

test("finds a portrait video in the Pixabay response", async () => {
  nock(pixabayHost)
    .get(searchPath)
    .reply(200, mockResponse, { "Content-Type": "application/json" });
  const pexels = new PexelsAPI("test-key");
  const video = await pexels.findVideo(["dog"], 2.4, []);
  expect(video).toEqual({
    id: "1001",
    url: "https://cdn.pixabay.com/video/test/1001-medium.mp4",
    width: 1080,
    height: 1920,
  });
});

test("should time out", async () => {
  nock(pixabayHost).get(searchPath).delay(1000).times(30).reply(200, {});
  const pexels = new PexelsAPI("test-key");
  await expect(
    pexels.findVideo(["dog"], 2.4, [], OrientationEnum.portrait, 100),
  ).rejects.toThrow(
    expect.objectContaining({
      name: "TimeoutError",
    }),
  );
});

test("should retry after timeouts", async () => {
  // The delayed answers would return video 2001. Only if they time out and
  // the request is retried does the third answer (video 1001) win.
  const lateResponse = mockResponse.replaceAll("1001", "2001");
  nock(pixabayHost)
    .get(searchPath)
    .delay(1000)
    .times(2)
    .reply(200, lateResponse, { "Content-Type": "application/json" });
  nock(pixabayHost)
    .get(searchPath)
    .reply(200, mockResponse, { "Content-Type": "application/json" });

  const pexels = new PexelsAPI("test-key");
  const video = await pexels.findVideo(
    ["dog"],
    2.4,
    [],
    OrientationEnum.portrait,
    100,
  );
  expect(video.id).toBe("1001");
});
