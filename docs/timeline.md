The timeline structure
======================

The "events" member of `timeline.json` is a flat of list events. The order of the list
does not say anything about the order in which the events occur. Events just occur
in the order in which they happen to be emitted.

If you need to add new events, the convention is to add them around the same location
as they should logically occur relative to some other event. The naming convention
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
        with two choices.

    chat::meme::intro::choice_see_cool::challenge::response (case 1)

        This event is not listed in `timeline.json` but
        occurs when the user presses the "Go away" button.

    chat::meme::intro::choice_see_cool::again

        This event is fired when the user presses the
        "Go away" button. It causes a chat bubble to
        appear with the "Sure you don't?" message.

    chat::meme::intro::choice_see_cool::challenge

        This event is also fired (again) when the user
        presses the "Go away" button. It causes a chat
        bubble with the choice to be shown again.

    chat::meme::intro::choice_see_cool::challenge::response (case 2)

        This event is not listed in `timeline.json` but
        occurs when the user presses the "Sure why not"
        button.

    chat::meme::intro::choice_see_cool::comment_here_goes

        This event causes a chat bubble to appear with
        "Okay, here goes".

    artifact::intro::choice_see_cool

        This event is fired when the the user presses the
        "Sure why not" button and registers that the artifact
        for intro::choice_see_cool has occured.

    event::intro::enable-wobbly-windows

        This event is also fired when the user presses the
        "Sure why not" button. It changes the GSettings key for
        org.gnome.Shell wobbly-effect to be true.

    listen::intro::wobble-window

        This event is also fired when the user presses the
        "Sure why not" button. It causes the `move-window` event
        to be registered as an event we are actively listening for
        and then emits the `ListenForEvent` signal with `move-window`.

        When the `move-window` signal is received we dispatch any events
        in the `received` section of this event. The game service will
        also emit the `StopListeningFor` signal to indicate that it no
        longer needs to know about that signal.

    listen::intro::stop-wobble-window

        This event is fired when the `move-window` external event is received
        by the game service (because the shell would have called into
        `ExternalEvent`). This happens because listen::intro::stop-wobble-window
        is listed as a member in the "received" part of
        listen::intro::wobble-window. This will cause `ListenForEvent` to be
        emitted with `stop-moving-windows`.

        This isn't to be confused with the `StopListeningFor` signal emitted
        earlier. That signal was to indicate to the shell that we are no longer
        interested in `move-window` events. This signal indicates to the shell
        that we are now interested for when the user *stops* moving a window
        (defined to be no grab-motion events within a five second period).

        When the event is received, the game service will emit `StopListeningFor`
        with `stop-moving-windows` - this indicates to the shell that we are no
        longer interested in events indicating that no windows are being moved
        and that the shell can disconnect any signal handlers or internal logic
        used to monitor window movement.
