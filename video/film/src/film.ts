// The whole film is data: film.json, written by video/make_film.py from facts.json, the voice timeline and the capture logs.
import filmJson from "../film.json";

export type Scene = { id: string; type: string; duration: number; transition?: { type: string; dur?: number }; [k: string]: any };
export type FilmData = {
  title: string; fps: number; width: number; height: number;
  captions?: string; captionsOff?: [number, number][];
  kolam: { d: string; dots: [number, number][]; view: number };
  facts: any;
  scenes: Scene[];
};
export const film = filmJson as unknown as FilmData;
