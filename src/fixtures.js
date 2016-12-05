function makeFakeRouterDriver () {
    return function routerDriver (routeIntent$) {
        routeIntent$.tap(console.log.bind(console, 'routerDriver : routeIntent$ :'))
    }
}
