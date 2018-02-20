```html
  <div class="ui fixed inverted menu">

#LOGO
    <div class="ui container">
      <a href="#" class="header item">
        <img class="logo" src="assets/images/logo.png">
        Project Name
      </a>

#HEADER
      <a href="#" class="item">Home</a>
      <div class="ui simple dropdown item">
        Dropdown <i class="dropdown icon"></i>
        <div class="menu">
          <a class="item" href="#">Link Item</a>
          <a class="item" href="#">Link Item</a>
          <div class="divider"></div>
          <div class="header">Header Item</div>
          <div class="item">
            <i class="dropdown icon"></i>
            Sub Menu
            <div class="menu">
              <a class="item" href="#">Link Item</a>
              <a class="item" href="#">Link Item</a>
            </div>
          </div>
          <a class="item" href="#">Link Item</a>
        </div>
      </div>
    </div>
  </div>

  <div class="ui main text container">

#MAIN
    <h1 class="ui header">Semantic UI Fixed Template</h1>
    <p>This is a basic fixed menu template using fixed size containers.</p>
    <p>A text container is used for the main container, which is useful for single column layouts</p>
    <img class="wireframe" src="assets/images/wireframe/media-paragraph.png">
    <img class="wireframe" src="assets/images/wireframe/paragraph.png">
    <img class="wireframe" src="assets/images/wireframe/paragraph.png">
    <img class="wireframe" src="assets/images/wireframe/paragraph.png">
    <img class="wireframe" src="assets/images/wireframe/paragraph.png">
    <img class="wireframe" src="assets/images/wireframe/paragraph.png">
    <img class="wireframe" src="assets/images/wireframe/paragraph.png">
  </div>

#FOOTER
  <div class="ui inverted vertical footer segment">
    <div class="ui center aligned container">
      <div class="ui stackable inverted divided grid">
        <div class="three wide column">
        # GROUP
          <h4 class="ui inverted header">Group 1</h4>
          <div class="ui inverted link list">
            <a href="#" class="item">Link One</a>
            <a href="#" class="item">Link Two</a>
            <a href="#" class="item">Link Three</a>
            <a href="#" class="item">Link Four</a>
          </div>
        </div>
        <div class="three wide column">
        # GROUP
          <h4 class="ui inverted header">Group 2</h4>
          <div class="ui inverted link list">
            <a href="#" class="item">Link One</a>
            <a href="#" class="item">Link Two</a>
            <a href="#" class="item">Link Three</a>
            <a href="#" class="item">Link Four</a>
          </div>
        </div>
        <div class="three wide column">
        # GROUP
          <h4 class="ui inverted header">Group 3</h4>
          <div class="ui inverted link list">
            <a href="#" class="item">Link One</a>
            <a href="#" class="item">Link Two</a>
            <a href="#" class="item">Link Three</a>
            <a href="#" class="item">Link Four</a>
          </div>
        </div>
        <div class="seven wide column">
        # FOOTER HEADER
          <h4 class="ui inverted header">Footer Header</h4>
          <p>Extra space for a call to action inside the footer that could help re-engage users.</p>
        </div>
      </div>

      # SITEMAP
      <div class="ui inverted section divider"></div>
      <img src="assets/images/logo.png" class="ui centered mini image">
      <div class="ui horizontal inverted small divided link list">
        <a class="item" href="#">Site Map</a>
        <a class="item" href="#">Contact Us</a>
        <a class="item" href="#">Terms and Conditions</a>
        <a class="item" href="#">Privacy Policy</a>
      </div>
    </div>
  </div>
```

```html
  <div class="ui fixed inverted menu" slot = 'header'>
#LOGO
#HEADER
  </div>

  <div class="ui main text container" slot = 'body'>
#MAIN
  </div>

  <div class="ui inverted vertical footer segment" slot = 'footer'>
#FOOTER
    <div class="ui center aligned container">
      <div class="ui stackable inverted divided grid">
        <div class="three wide column">
        # GROUP
        </div>
        <div class="three wide column">
        # GROUP
        </div>
        <div class="three wide column">
        # GROUP
        </div>
        <div class="seven wide column">
        # FOOTER HEADER
        </div>
      </div>
      <div class="ui inverted section divider"></div>
      # SITEMAP
      </div>
    </div>
  </div>
```
