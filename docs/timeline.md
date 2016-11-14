The timeline structure
======================

The "events" member of `timeline.json` is a flat of list events. The order of the list
does not say anything about the order in which the events occurr. Events just occur
in the order in which they happen to be emitted.

If you need to add new events, the convention is to add them around the same location
as they should logically occurr relative to some other event. The naming convention
is not strictly enforced, but it is useful to give events name which identify
their type, which actor they relate to, the mission they are for, the individual
interaction of that mission and the part of that event sequence making up the
interaction. For instance, the following interaction:

    MEME: Wanna see something cool?
                    USER: 1. Go away
                          2. Sure, why not
                    
                    USER: Go away
    
    MEME: Sure you don't?
                    USER: 1. Go away
                          2. Sure, why not

                    USER: Sure, why not

    MEME: Okay, here goes
    *Register artifact 'choice_see_cool'*
    *Enable org.gnome.Shell wobbly-effect*
    *Listen for window movement*

is made up of the following events:

    chat::meme::intro::choice_see_cool::comment
    
        This event causes a chat bubble to appear with
        "Wanna see something cool?"
    
    chat::meme::intro::choice_see_cool::challenge
    
        This event causes a "user input bubble" to appear
        wiht two choices.
    
    chat::meme::intro::choice_see_cool::challenge::response

        This event is not listed in `timeline.json` but
        occurrs when the user presses the "Go away" button.
    
    chat::meme::intro::choice_see_cool::again

        This event is fired when the user presses the
        "Go away" button. It causes a chat bubble to
        appear with the "Sure you don't?" message.

    chat::meme::intro::choice_see_cool::challenge
    
        This event is also fired (again) when the user
        presses the "Go away" button.

    chat::meme::intro::choice_see_cool::challenge::response

        This event is not listed in `timeline.json` but
        occurrs when the user presses the "Sure why not"
        button.

    artifact::intro::choice_see_cool

        This event is fired when the the user presses the
        "Sure why not" button and registers that the artifact
        for intro::choice_see_cool has occurred.

    event::intro::enable-wobbly-windows

        This event is also fired when the user presses the
        "Sure why not" button. It changes the GSettings key for
        org.gnome.Shell wobbly-effect to be true.

    listen::intro::wobble-window

        This event is also fired when the user presses the
        "Sure why not" button. It causes the 'move-window' event
        to be registered as an event we are actively listening for
        and then emits the `ListenForEvent` signal with `move-window`.
