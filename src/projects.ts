export function setupProjects(dialog: HTMLDialogElement) {
  if (typeof dialog.showModal !== 'function') return
  const cards = [...document.querySelectorAll<HTMLElement>('.project-card')]
  const title = dialog.querySelector<HTMLElement>('#case-title')!
  const status = dialog.querySelector<HTMLElement>('#case-status')!
  const description = dialog.querySelector<HTMLElement>('#case-description')!
  const media = dialog.querySelector<HTMLElement>('#case-media')!
  const detail = dialog.querySelector<HTMLElement>('#case-details')!
  const previous = dialog.querySelector<HTMLButtonElement>('#case-previous')!
  const next = dialog.querySelector<HTMLButtonElement>('#case-next')!
  let active = 0
  let transition: Animation | undefined

  function show(index: number) {
    active = (index + cards.length) % cards.length
    const card = cards[active]
    const heading = card.querySelector('h3')!
    title.textContent = heading.textContent
    status.replaceChildren(card.querySelector('.pill')!.cloneNode(true))
    description.textContent = heading.nextElementSibling?.textContent ?? ''
    media.replaceChildren(card.querySelector('figure')!.cloneNode(true))
    const preview = media.querySelector('img')
    if (preview) preview.loading = 'eager'
    const details = card.querySelector('details')!
    const elements = [...details.children].filter(element => element.tagName !== 'SUMMARY')
    const tags = card.querySelector('.tags')
    if (tags) elements.push(tags)
    detail.replaceChildren(...elements.map(element => element.cloneNode(true)))
    if (!dialog.open || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    transition?.cancel()
    transition = dialog.querySelector<HTMLElement>('#case-content')!.animate(
      [{ transform: 'translateY(12px)' }, { transform: 'none' }],
      { duration: 340, easing: 'cubic-bezier(.2,.65,.3,1)' },
    )
  }

  cards.forEach((card, index) => {
    const title = card.querySelector('h3')!.textContent
    const details = card.querySelector('details')!
    const button = document.createElement('button')
    button.className = 'button button--outline project-open'
    button.type = 'button'
    button.textContent = 'View project'
    button.setAttribute('aria-label', 'View project: ' + title)
    button.setAttribute('aria-haspopup', 'dialog')
    button.addEventListener('click', () => {
      show(index)
      dialog.showModal()
      dialog.scrollTop = 0
    })
    card.querySelector('.project-body')!.append(button)
    details.hidden = true
  })

  previous.addEventListener('click', () => show(active - 1))
  next.addEventListener('click', () => show(active + 1))
  dialog.addEventListener('close', () => {
    transition?.cancel()
    media.replaceChildren()
  })
}
