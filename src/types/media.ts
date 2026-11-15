export type MediaType = 'film' | 'series'

export interface MediaTitle {
  id: string
  title: string
  type: MediaType
  /** Release year (first season for series). */
  year: number
  genres: string[]
  moods: string[]
  themes: string[]
  /** Original short synopsis written for this demo. */
  description: string
  /** Films: runtime in minutes. Series: approximate total runtime of all episodes, in minutes. */
  duration: number
  seasons?: number
  episodes?: number
  /** Optional local artwork; cards fall back to generated artwork. */
  posterUrl?: string
}
