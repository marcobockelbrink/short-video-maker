/* eslint-disable @remotion/deterministic-randomness */
// Abwandlung: Klasse und Methode heißen weiter PexelsAPI/findVideo, damit die
// Aufrufer unberührt bleiben; die Videos kommen aber von der Pixabay-API.
import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

type PixabayFile = { url: string; width: number; height: number };
type PixabayHit = {
  id: number;
  duration: number;
  videos: Record<string, PixabayFile | undefined>;
};

export class PexelsAPI {
  constructor(private API_KEY: string) {}

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("API key not set");
    }
    logger.debug(
      { searchTerm, minDurationSeconds, orientation },
      "Searching for video in Pixabay API",
    );
    const response = await fetch(
      `https://pixabay.com/api/videos/?key=${encodeURIComponent(this.API_KEY)}&per_page=50&safesearch=true&q=${encodeURIComponent(searchTerm.slice(0, 100))}`,
      {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(timeout),
      },
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            throw new Error(
              "Invalid Pixabay API key - please get a key from https://pixabay.com/api/docs/ and set it in the environment variable PIXABAY_API_KEY",
            );
          }
          throw new Error(`Pixabay API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .catch((error: unknown) => {
        logger.error(error, "Error fetching videos from Pixabay API");
        throw error;
      });
    const videos = response.hits as PixabayHit[];

    const { width: requiredVideoWidth, height: requiredVideoHeight } =
      getOrientationConfig(orientation);

    if (!videos || videos.length === 0) {
      logger.error(
        { searchTerm, orientation },
        "No videos found in Pixabay API",
      );
      throw new Error("No videos found");
    }

    // Pixabay kennt keinen Orientierungsfilter: nach Maßen auswählen.
    // Erst exakt passende Größe, sonst die kleinste Datei mit richtiger
    // Ausrichtung, die mindestens so groß ist wie verlangt.
    const portrait = requiredVideoHeight > requiredVideoWidth;
    const filteredVideos = videos
      .map((video) => {
        if (excludeIds.includes(String(video.id))) {
          return;
        }
        if (video.duration < minDurationSeconds + durationBufferSeconds) {
          return;
        }
        const files = Object.values(video.videos ?? {}).filter(
          (f): f is PixabayFile => !!f && !!f.url && f.width > 0,
        );
        const exact = files.find(
          (f) =>
            f.width === requiredVideoWidth && f.height === requiredVideoHeight,
        );
        const fallback = files
          .filter(
            (f) =>
              f.height > f.width === portrait &&
              f.width >= requiredVideoWidth &&
              f.height >= requiredVideoHeight,
          )
          .sort((a, b) => a.width - b.width)[0];
        const file = exact ?? fallback;
        if (!file) {
          return;
        }
        return {
          id: String(video.id),
          url: file.url,
          width: file.width,
          height: file.height,
        };
      })
      .filter(Boolean);
    if (!filteredVideos.length) {
      logger.error({ searchTerm }, "No videos found in Pixabay API");
      throw new Error("No videos found");
    }

    const video = filteredVideos[
      Math.floor(Math.random() * filteredVideos.length)
    ] as Video;

    logger.debug(
      { searchTerm, video: video, minDurationSeconds, orientation },
      "Found video from Pixabay API",
    );

    return video;
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    retryCounter: number = 0,
  ): Promise<Video> {
    // shuffle the search terms to randomize the search order
    const shuffledJokerTerms = jokerTerms.sort(() => Math.random() - 0.5);
    const shuffledSearchTerms = searchTerms.sort(() => Math.random() - 0.5);

    for (const searchTerm of [...shuffledSearchTerms, ...shuffledJokerTerms]) {
      try {
        return await this._findVideo(
          searchTerm,
          minDurationSeconds,
          excludeIds,
          orientation,
          timeout,
        );
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error instanceof DOMException &&
          error.name === "TimeoutError"
        ) {
          if (retryCounter < retryTimes) {
            logger.warn(
              { searchTerm, retryCounter },
              "Timeout error, retrying...",
            );
            return await this.findVideo(
              searchTerms,
              minDurationSeconds,
              excludeIds,
              orientation,
              timeout,
              retryCounter + 1,
            );
          }
          logger.error(
            { searchTerm, retryCounter },
            "Timeout error, retry limit reached",
          );
          throw error;
        }

        logger.error(error, "Error finding video in Pixabay API for term");
      }
    }
    logger.error(
      { searchTerms },
      "No videos found in Pixabay API for the given terms",
    );
    throw new Error("No videos found in Pixabay API");
  }
}
