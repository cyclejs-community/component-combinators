After working and struggling on a pretty large cyclejs application, I set up to work on four areas
 of interest to improve my productivity by leaps and bounds when working in the large with cyclejs. 
 I finally completed an advanced draft for the first step, which is a refined component model, 
extracted and abstracted from the 20K+ lines of javascript I was extending and maintaining. 
That component model for cycle in some ways is an extension of that of react, 
incorporates a DOM slot mechanism à la web components and is tied with component combinators 
which abstract common patterns (routing, iteration, control flow, etc.).
It works pretty nicely even though the whole thing is still but a proof of concept. It is already 
useful to me in the current form, so I publish it in the `cyclejs-community` repo with the hope that
 it will also be of use, or at least of interest, to the community.

While the concept is pretty simple, this is not a small piece of work, there are 10+ combinators, 
so there will be some reading to get acquainted with every single thing. Naturally, you need to 
know a minimum about cycle and streams. Hopefully though, the general idea should sink in 
relatively fast. I invite you to have a look, check the demos, documentation and articles, and 
let me know what you think. 

The entry point would be the [README](https://github.com/cyclejs-community/component-combinators)

@brugge : had a look at cyclejs-modal. It is pretty useful. I will convert cyclejs-modal to the 
combinator API for the next version of the library.

@widdershin
@brahmutov : next step is to work on debuggability, error messaging and testing
@geraud
@milankinen
@laszlokorte private message
