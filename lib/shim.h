#ifndef _CODING_GAME_SERIVCE_SHIM_H
#define _CODING_GAME_SERVICE_SHIM_H

#include <glib-2.0/glib.h>
#include <glib-2.0/glib-object.h>

G_BEGIN_DECLS

#define CODING_GAME_SERVICE_TYPE_APP_INTEGRATION_CONTROLLER (coding_game_service_app_integration_controller_get_type ())

G_DECLARE_FINAL_TYPE (CodingGameServiceAppIntegrationController,
                      coding_game_service_app_integration_controller,
                      CODING_GAME_SERVICE,
                      APP_INTEGRATION_CONTROLLER,
                      GObject)

CodingGameServiceAppIntegrationController *coding_game_service_app_integration_controller_new ();

typedef void (*CodingGameServiceAppIntegrationControllerInterestCallback)(CodingGameServiceAppIntegrationController *controller, gpointer user_data);

/**
 * coding_game_service_app_integration_controller_service_event_with_listener:
 * @controller: A #CodingGameServiceAppIntegrationController
 * @event_name: The event name to respond to
 * @register_interest_cb: (closure register_user_data) (destroy destroy_register_data): Callback
 * to call when we the game service is interested in an event. Set up any event handlers
 * internally here.
 * @register_user_data: User data to provide to register_interest_cb
 * @destroy_register_data: A #GDestroyNotify for register_user_data
 * @deregister_interest_cb: (closure deregister_user_data) (destroy destroy_deregister_data): Callback
 * to call when we the game service is not longer interested in an event. Remove any event
 * handlers internally here.
 * @deregister_user_data: User data to provide to deregister_interest_cb
 * @destroy_deregister_data: A #GDestroyNotify for deregister_user_data
 *
 * Register a listener that is capable of servicing event_name during the
 * period that the service is interested in the event. The first callback will
 * be called either immediately or when the service becomes interested in the
 * event. From here, the app should enable any functionality used to listen
 * for the relevant event. The second callback is called when the service
 * is no longer interested in the event, at which point the app can deregister
 * any functionality it had enabled.
 *
 * If the event is considered to have "occurred", call
 * coding_game_service_app_integration_controller_event_occurred with the
 * event name.
 */
void
coding_game_service_app_integration_controller_service_event_with_listener(CodingGameServiceAppIntegrationController *controller,
                                                                           const gchar *event_name,
                                                                           CodingGameServiceAppIntegrationControllerInterestCallback register_interest_cb,
                                                                           gpointer register_user_data,
                                                                           GDestroyNotify destroy_register_data,
                                                                           CodingGameServiceAppIntegrationControllerInterestCallback deregister_interest_cb,
                                                                           gpointer deregister_user_data,
                                                                           GDestroyNotify destroy_deregister_data);

/**
 * coding_game_service_app_integration_controller_event_occurred:
 * @controller: A #CodingGameServiceAppIntegrationController
 * @event_name: The event name that ocurred.
 *
 * Tell the game service that an event ocurred. Call this from one of
 * your event handlers.
 */
void
coding_game_service_app_integration_controller_event_occurred(CodingGameServiceAppIntegrationController *controller,
                                                              const gchar *event_name);

G_END_DECLS

#endif
