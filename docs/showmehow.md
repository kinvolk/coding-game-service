Interaction between Coding-Game-Service and Showmehow-Service
=============================================================

There is no explicit interaction between `showmehow-service` and
`coding-game-service`, though the former does play a role in the
overall system.

In some cases, we might send "input bubbles" to the chatbox,
which allow the user to either select a choice or enter some
free text. In the case of a choice, there are only
N possible options, so it is possible to handle each
"response" in the timeline.

For free text, we would require some kind of matching system.
How text is to be matched depends on what the user is responding
to. For instance, sometimes text might just be matched with a
regular expression of some sort. But other times we might want
to execute what the user typed through the shell and match
on the response. For these cases, `showmehow-service` provides
an engine to handle all these different kinds of responses.

`coding-game-service` only understands discrete responses that
either completely match what is in an event's `responses`
member. It is an error to pass it a response that it not
found there. `showmehow-service` will take the free text and turn
it into one of the known responses.

Right now, the interaction with `showmehow-service` is done on the
client side (for instance, in the chatbox). When a
user input bubble is passed to the chatbox, we may
also optionally pass a `showmehow_id` which indicates
that the response should be processed by `showmehow-service` first
and then sent to the game service through
the `ChatResponse` method.

Interaction between Coding-Game-Service and Showmehow
=====================================================

There is no interaction here at the moment. `showmehow`
still uses `showmehow-service` to validate the responses
to its questions out-of-process.

In the future, `showmehow` might be an external events
provider for missions in `coding-game-service`. Passing
`showmehow` lessons might cause "artifacts" to be found
and added to the game manager.
