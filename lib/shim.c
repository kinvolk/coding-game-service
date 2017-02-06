/* lib/shim.c
 *
 * Copyright (c) 2017 Endless Mobile Inc.
 *
 * A small helper library to ease integration with coding-game-service'
 * external events.
 */

#include <CodingGameService.h>
#include "shim.h"

struct _CodingGameServiceAppIntegrationControllerClass {
  GObjectClass parent_class;
};

struct _CodingGameServiceAppIntegrationController {
  GObject parent;

  GHashTable *event_handlers;
  CodingGameServiceCodingGameService *service;
} CodingGameServiceAppIntegrationControllerPrivate;

G_DEFINE_TYPE (CodingGameServiceAppIntegrationController,
               coding_game_service_app_integration_controller,
               G_TYPE_OBJECT);

typedef struct _AppIntegrationData {
  CodingGameServiceAppIntegrationControllerInterestCallback callback;
  gpointer data;
  GDestroyNotify destroy_data;
} AppIntegrationData;

typedef struct _AppIntegrationDataPair {
  AppIntegrationData register_data;
  AppIntegrationData deregister_data;
  gboolean registered;
} AppIntegrationDataPair;

static void
app_integration_data_pair_free(gpointer data) {
  AppIntegrationDataPair *pair = (AppIntegrationDataPair *) data;

  if (pair->register_data.destroy_data) {
    (*pair->register_data.destroy_data)(pair->register_data.data);
  }
  if (pair->deregister_data.destroy_data) {
    (*pair->deregister_data.destroy_data)(pair->deregister_data.data);
  }

  g_free(data);
}

static AppIntegrationDataPair *
app_integration_data_pair_new(CodingGameServiceAppIntegrationControllerInterestCallback register_interest_cb,
                              gpointer register_user_data,
                              GDestroyNotify destroy_register_data,
                              CodingGameServiceAppIntegrationControllerInterestCallback deregister_interest_cb,
                              gpointer deregister_user_data,
                              GDestroyNotify destroy_deregister_data)
{
  AppIntegrationDataPair *pair = g_new0(AppIntegrationDataPair, 1);

  g_return_val_if_fail(pair, NULL);

  pair->register_data.callback = register_interest_cb;
  pair->register_data.data = register_user_data;
  pair->register_data.destroy_data = destroy_register_data;

  pair->deregister_data.callback = deregister_interest_cb;
  pair->deregister_data.data = deregister_user_data;
  pair->deregister_data.destroy_data = destroy_deregister_data;

  pair->registered = FALSE;
  return pair;
}

void
coding_game_service_app_integration_controller_service_event_with_listener(CodingGameServiceAppIntegrationController *controller,
                                                                           const gchar *event_name,
                                                                           CodingGameServiceAppIntegrationControllerInterestCallback register_interest_cb,
                                                                           gpointer register_user_data,
                                                                           GDestroyNotify destroy_register_data,
                                                                           CodingGameServiceAppIntegrationControllerInterestCallback deregister_interest_cb,
                                                                           gpointer deregister_user_data,
                                                                           GDestroyNotify destroy_deregister_data)
{
  g_return_if_fail(!g_hash_table_lookup(controller->event_handlers, event_name));

  AppIntegrationDataPair *pair = app_integration_data_pair_new(register_interest_cb,
                                                               register_user_data,
                                                               destroy_register_data,
                                                               deregister_interest_cb,
                                                               deregister_user_data,
                                                               destroy_deregister_data);
  g_return_if_fail(pair != NULL);
  g_hash_table_insert(controller->event_handlers, g_strdup(event_name), pair);

  /* If we don't have a service, it means the connection failed. We should
   * still allow the event handler to be inserted, but it just won't have
   * its register callback called */
  if (!controller->service) {
    return;
  }

  /* Check the underlying property to see if we are already interested
   * in this signal. If so, call the event handler straight away */
  const gchar * const *listening_for = coding_game_service_coding_game_service_get_currently_listening_for_events(controller->service);
  while (*listening_for) {
    if (g_strcmp0(*listening_for, event_name) == 0) {
      (*register_interest_cb)(controller, register_user_data);
      break;
    }

    ++listening_for;
  }
}

void
coding_game_service_app_integration_controller_event_occurred(CodingGameServiceAppIntegrationController *controller,
                                                              const gchar *event_name)
{
  /* We just call the ExternalEvent function without listening for a
   * callback, since we don't particularly care if it was successful
   * or not. */
  coding_game_service_coding_game_service_call_external_event(controller->service,
                                                              event_name,
                                                              NULL,
                                                              NULL,
                                                              NULL);
}

static void
coding_game_service_app_integration_controller_events_changed(GObject *object,
                                                              GParamSpec *pspec,
                                                              gpointer user_data)
{
  CodingGameServiceAppIntegrationController *controller = CODING_GAME_SERVICE_APP_INTEGRATION_CONTROLLER(user_data);

  /* How else would the signal have been fired ? */
  g_assert(controller->service != NULL);

  const gchar * const *listening_for = coding_game_service_coding_game_service_get_currently_listening_for_events(controller->service);

  /* Check all currently registered callbacks and deregister any that are not
   * in the list of currently active events */
  GHashTableIter iter;
  g_hash_table_iter_init(&iter, controller->event_handlers);
  gpointer key, value;

  while(g_hash_table_iter_next(&iter, &key, &value)) {
    AppIntegrationDataPair *pair = (AppIntegrationDataPair *) value;
    gboolean contained_in_strv = g_strv_contains(listening_for, (const gchar *) key);
    if (pair->registered && !contained_in_strv) {
      if (pair->deregister_data.callback) {
        (*pair->deregister_data.callback)(controller, pair->deregister_data.data);
      }

      /* Remove this element from the hash table */
      g_hash_table_iter_remove(&iter);
    } else if (!pair->registered && contained_in_strv) {
      if (pair->register_data.callback) {
        (*pair->register_data.callback)(controller, pair->register_data.data);
      }

      pair->registered = TRUE;
    }
  }
}

static void
coding_game_service_app_integration_controller_dispose(GObject *object)
{
  CodingGameServiceAppIntegrationController *controller = CODING_GAME_SERVICE_APP_INTEGRATION_CONTROLLER(object);

  g_clear_object(&controller->service);

  /* Go over all of the remaining entries in the event_handlers and call their
   * deregister callbacks, then destroy them. We do this in dispose since the
   * user data for the callbacks may be holding a reference to us and we
   * need to ensure that those references are dropped during the destruction
   * cycle. */
  GHashTableIter iter;
  g_hash_table_iter_init(&iter, controller->event_handlers);
  gpointer key, value;

  while(g_hash_table_iter_next(&iter, &key, &value)) {
    AppIntegrationDataPair *pair = (AppIntegrationDataPair *) value;
    if (pair->registered && pair->deregister_data.callback) {
      (*pair->deregister_data.callback)(controller, pair->deregister_data.data);
    }

    g_hash_table_iter_remove(&iter);
  }
}

static void
coding_game_service_app_integration_controller_init(CodingGameServiceAppIntegrationController *controller)
{
  controller->service = coding_game_service_coding_game_service_proxy_new_for_bus_sync(G_BUS_TYPE_SESSION,
                                                                                       G_DBUS_PROXY_FLAGS_NONE,
                                                                                       "com.endlessm.CodingGameService.Service",
                                                                                       "/com/endlessm/CodingGameService/Service",
                                                                                       NULL,
                                                                                       NULL);
  controller->event_handlers = g_hash_table_new_full(g_str_hash,
                                               g_str_equal,
                                               g_free,
                                               app_integration_data_pair_free);

  if (controller->service) {
    g_signal_connect_object(controller->service,
                            "notify::currently-listening-for-events",
                            G_CALLBACK(coding_game_service_app_integration_controller_events_changed),
                            controller,
                            0);
  }
}

CodingGameServiceAppIntegrationController *
coding_game_service_app_integration_controller_new () {
  return g_object_new(CODING_GAME_SERVICE_TYPE_APP_INTEGRATION_CONTROLLER, NULL);
}

static void
coding_game_service_app_integration_controller_class_init(CodingGameServiceAppIntegrationControllerClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS(klass);

  gobject_class->dispose = coding_game_service_app_integration_controller_dispose;
}
