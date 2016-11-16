The Game Manager
================

`coding-game-manager` is essentially just a sidebar view that displays
the current state of the game service (and thus, the user's progress
in the game).

It has a binding to the following properties:

    CurrentMissionName
    CurrentMissionDesc
    CurrentMissionPoints  
    CurrentMissionNumTasks
    CurrentMissionNumTasksAvailable
    CurrentMissionAvailablePoints

Events that occur within `coding-game-service` might cause these properties
to be updated and those updates will be immediately reflected by
`coding-game-manager`. For instance, the current mission name
might change due to the `start-mission` event changing it, or the
user might obtain an artifact which changes `CurrentMissionNumTasks`
and `CurrentMissionPoints` property.
