export const destinations = {
  about: {
    title: 'Habitat · About',
    description: 'Meet Anar and read about his education and independent student work.',
    position: [-7, 4],
  },
  projects: {
    title: 'Observatory · Projects',
    description: 'Explore the Planetary Twin submission, game hardware, and software projects.',
    position: [2, -4],
  },
  achievements: {
    title: 'Archives · Achievements',
    description: 'Read about the team’s NASA Space Apps Challenge submission in Ulaanbaatar.',
    position: [-7, -7],
  },
  skills: {
    title: 'Workshop · Skills',
    description: 'Browse the tools Anar uses in software, hardware, and creative projects.',
    position: [7, 5],
  },
  contact: {
    title: 'Relay · Contact',
    description: 'Find Anar’s public GitHub profile.',
    position: [10, -6],
  },
} as const

export type Destination = keyof typeof destinations

export function isDestination(value: string | undefined): value is Destination {
  return value !== undefined && Object.hasOwn(destinations, value)
}
