export function setupMotion(reducedMotion: MediaQueryList) {
  const root = document.documentElement
  const hero = document.querySelector<HTMLElement>('.hero')!
  const timeline = document.querySelector<HTMLElement>('.competition-timeline')!
  const nav = [...document.querySelectorAll<HTMLAnchorElement>('.site-nav a')]
  const sections = [...document.querySelectorAll<HTMLElement>('main .section')].reverse()
  const animated = new Set<Animation>()
  const reveals = document.querySelectorAll<HTMLElement>(
    '.section-heading h2, .section-heading > p:last-child, .project-card, .profile-details article, .competition-detail, .skills-grid article',
  )
  const motionCurve = 'cubic-bezier(.2, .66, .28, 1)'
  const clamp = (value: number) => Math.max(0, Math.min(1, value))

  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        if (reducedMotion.matches || typeof entry.target.animate !== 'function') continue
        const media = entry.target.querySelector<HTMLImageElement>('.project-media img')
        const motion = entry.target.animate(
          [{ transform: 'translateY(25px)', clipPath: 'inset(0 0 8% 0)' }, { transform: 'none', clipPath: 'inset(0)' }],
          { duration: 670, easing: motionCurve },
        )
        const imageMotion = media?.animate([{ scale: 1.11 }, { scale: 1 }], { duration: 1050, easing: motionCurve })
        for (const animation of [motion, imageMotion]) {
          if (!animation) continue
          animated.add(animation)
          animation.onfinish = animation.oncancel = () => { animated.delete(animation) }
        }
      }
    }, { threshold: 0.12 })
    reveals.forEach(element => observer.observe(element))
  }

  let frame = 0
  let current = ''
  function update() {
    frame = 0
    const y = window.scrollY
    const scrollable = root.scrollHeight - innerHeight
    root.style.setProperty('--reading-progress', String(scrollable > 0 ? clamp(y / scrollable) : 0))
    if (reducedMotion.matches) {
      hero.style.removeProperty('--hero-drift')
      timeline.style.removeProperty('--timeline-progress')
    } else {
      const distance = Math.min(hero.offsetHeight, y)
      hero.style.setProperty('--hero-drift', Math.round(distance * 0.18) + 'px')
      const box = timeline.getBoundingClientRect()
      const progress = clamp((innerHeight * 0.76 - box.top) / Math.max(1, box.height))
      timeline.style.setProperty('--timeline-progress', String(progress))
    }

    const pick = sections.find(section => section.getBoundingClientRect().top <= innerHeight * 0.38)?.id
    const active = y + 2 >= scrollable && scrollable > 0 ? sections[0]?.id : pick
    if ((active ?? '') !== current) {
      current = active ?? ''
      for (const link of nav) {
        if (link.hash === '#' + current) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      }
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) animated.forEach(animation => animation.cancel())
    schedule()
  })
  update()
}
