import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { routes } from '@/config/routes'
import { forceReloadWindow } from '@/utils/helpers'

type RouteParams = Record<string, string>
type ResolveHook = (params: RouteParams) => Promise<boolean | void> | boolean | void
type RedirectHook = (params: RouteParams) => Route | string

export interface Route {
  name?: string
  path: string
  screen: ScreenName
  params?: RouteParams
  redirect?: RedirectHook
  onResolve?: ResolveHook
}

type RouteChangedHandler = (newRoute: Route, oldRoute: Route | undefined) => any

export default class Router {
  public $currentRoute: Ref<Route>

  private readonly homeRoute: Route
  private readonly notFoundRoute: Route
  private routeChangedHandlers: RouteChangedHandler[] = []
  private cache: Map<string, { route: Route, params: RouteParams }> = new Map()

  constructor () {
    this.homeRoute = routes.find(({ screen }) => screen === 'Home')!
    this.notFoundRoute = routes.find(({ screen }) => screen === '404')!
    this.$currentRoute = ref(this.homeRoute)

    watch(
      this.$currentRoute,
      (newValue, oldValue) => this.routeChangedHandlers.forEach(async handler => await handler(newValue, oldValue)),
      {
        deep: true,
        immediate: true,
      },
    )

    addEventListener('popstate', () => this.resolve(), true)
  }

  public static go (path: string | number, reload = false) {
    if (typeof path === 'number') {
      history.go(path)
      return
    }

    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    if (!path.startsWith('/#')) {
      path = `/#${path}`
    }

    path = path.substring(1, path.length)
    location.assign(`${location.origin}${location.pathname}${path}`)

    reload && forceReloadWindow()
  }

  public async resolve () {
    if (!location.hash || location.hash === '#/' || location.hash === '#!/') {
      return Router.go(this.homeRoute.path)
    }

    const matched = this.tryMatchRoute()
    const [route, params] = matched ? [matched.route, matched.params] : [null, null]

    if (!route) {
      return this.triggerNotFound()
    }

    if ((await route.onResolve?.(params)) === false) {
      return this.triggerNotFound()
    }

    if (route.redirect) {
      const to = route.redirect(params)
      return typeof to === 'string' ? Router.go(to) : this.activateRoute(to, params)
    }

    return this.activateRoute(route, params)
  }

  public triggerNotFound = async () => await this.activateRoute(this.notFoundRoute)
  public onRouteChanged = (handler: RouteChangedHandler) => this.routeChangedHandlers.push(handler)

  public async activateRoute (route: Route, params: RouteParams = {}) {
    this.$currentRoute.value = route
    this.$currentRoute.value.params = params
  }

  private tryMatchRoute () {
    if (!this.cache.has(location.hash)) {
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i]
        const matches = location.hash.match(new RegExp(`^#!?${route.path}/?(?:\\?(.*))?$`))

        if (matches) {
          const searchParams = new URLSearchParams(new URL(location.href.replace('#/', '')).search)

          this.cache.set(location.hash, {
            route,
            params: Object.assign(Object.fromEntries(searchParams.entries()), matches.groups || {}),
          })

          break
        }
      }
    }

    return this.cache.get(location.hash)
  }

  public static url (name: string, params: object = {}) {
    const route = routes.find(route => route.name === name)

    if (!route) {
      throw new Error(`Route ${name} not found`)
    }

    let path = route.path

    // replace the params in the path with the actual values
    Object.keys(params).forEach(key => {
      path = path.replace(new RegExp(`\\(\\?<${key}>.*?\\)`), params[key])
    })

    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    if (!path.startsWith('/#')) {
      path = `/#${path}`
    }

    return path
  }
}
