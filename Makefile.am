# Arbitrary files
arbitrary_files = files/sw.txt files/background_pic.jpg files/test.txt

filesdir = $(pkgdatadir)/files
files_DATA = $(arbitrary_files)

# Resource javascript modules
resource_dist_js_files = \
	lib/desktopFile.js \
	lib/validation.js \
	$(NULL)

resource_nondist_js_files = \
	lib/config.js \
	$(NULL)

lib/config.js: $(srcdir)/lib/config.js.in
	$(AM_V_GEN) mkdir -p lib/ && \
	sed -e 's,%CODING_FILES_DIR%,$(pkgdatadir)/files,g' \
	    -e 's,%CODING_COPY_FILES_SCRIPT%,$(pkglibexecdir)/coding-copy-files,g' \
	$< > $@.tmp && \
	mv -f $@.tmp $@

# All javascript modules
all_dist_js_files = \
	coding-game-validator.js \
	coding-game-service.js \
	$(resource_dist_js_files) \
	$(NULL)

all_js_files = \
	$(all_dist_js_files) \
	$(resource_nondist_js_files) \
	$(NULL)


AM_CONFIG_MACRO_DIR =
AM_DISTCHECK_CONFIGURE_FLAGS = --enable-introspection
EXTRA_DIST = \
	com.endlessm.CodingGameService.xml \
	com.endlessm.CodingGameService.service.in \
	com.endlessm.CodingGameService.gresource.xml \
	data/timeline.json.unvalidated.in \
	com.endlessm.Coding.policy.in \
	files/coding-copy-files.js.in \
	lib/config.js.in \
	$(all_dist_js_files) \
	$(arbitrary_files) \
	$(NULL)
CLEANFILES =

# GDBus-Codegen for CodingGameService
CodingGameService.c: $(srcdir)/com.endlessm.CodingGameService.xml
	gdbus-codegen --generate-c-code CodingGameService --c-namespace CodingGameService --c-generate-object-manager --interface-prefix com.endlessm. $<

CodingGameService.h: CodingGameService.c

gdbus_codegen_built_sources = CodingGameService.c CodingGameService.h

# Validation of timeline (produces data.timeline)
data/timeline.json: $(srcdir)/data/timeline.json.unvalidated.in $(all_js_files)
	mkdir -p data
	cp $< $@

# GResources
resource_files = \
	$(resource_dist_js_files) \
	$(resource_nondist_js_files) \
	data/timeline.json \
	$(NULL)

coding-game-service-resources.h: $(srcdir)/com.endlessm.CodingGameService.gresource.xml $(resource_files)
	$(AM_V_GEN) glib-compile-resources --target=$@ --sourcedir=$(srcdir) --sourcedir=$(builddir) --generate --c-name coding_game_service $<
coding-game-service-resources.c: $(srcdir)/com.endlessm.CodingGameService.gresource.xml $(resource_files)
	$(AM_V_GEN) glib-compile-resources --target=$@ --sourcedir=$(srcdir) --sourcedir=$(builddir) --generate --c-name coding_game_service $<

resources_built_sources = coding-game-service-resources.c coding-game-service-resources.h

# Generate the CodingGameService GDBus Skeleton library
libcoding_game_service_1_0_la_SOURCES = $(resources_built_sources) \
					$(gdbus_codegen_built_sources) \
					$(NULL)
libcoding_game_service_1_0_la_CFLAGS = $(CODING_GAME_SERVICE_CFLAGS)
libcoding_game_service_1_0_la_LIBADD = $(CODING_GAME_SERVICE_LIBS)

# All libraries
lib_LTLIBRARIES = libcoding_game_service-1.0.la

# Scripts to install
bin_SCRIPTS = \
	coding-game-service \
	coding-game-validator \
	$(NULL)

coding-game-service: $(srcdir)/coding-game-service.js
	cp $< $@
	chmod +x $@

coding-game-validator: $(srcdir)/coding-game-validator.js
	cp $< $@
	chmod +x $@

# Header files to install
coding_game_serviceincludedir = $(includedir)/coding-game-service
nobase_coding_game_serviceinclude_HEADERS = \
	CodingGameService.h

# GObject-Introspection support
include $(INTROSPECTION_MAKEFILE)
INTROSPECTION_GIRS = $(NULL)
INTROSPECTION_SCANNER_ARGS = --add-include-path=$(srcdir) --warn-all
INTROSPECTION_COMPILER_ARGS = --includedir=$(srcdir)

if HAVE_INTROSPECTION
introspection_sources = $(libcoding_game_service_1_0_la_SOURCES)

CodingGameService-1.0.gir: libcoding_game_service-1.0.la
CodingGameService_1_0_gir_INCLUDES = GObject-2.0 Gio-2.0
CodingGameService_1_0_gir_CFLAGS = $(INCLUDES)
CodingGameService_1_0_gir_LIBS = libcoding_game_service-1.0.la
CodingGameService_1_0_gir_FILES = $(introspection_sources)
INTROSPECTION_GIRS += CodingGameService-1.0.gir

girdir = $(datadir)/gir-1.0
gir_DATA = $(INTROSPECTION_GIRS)

typelibdir = $(libdir)/girepository-1.0
typelib_DATA = $(INTROSPECTION_GIRS:.gir=.typelib)

CLEANFILES += $(gir_DATA) $(typelib_DATA)
endif

# DBus Service
servicedir = $(datadir)/dbus-1/services
service_DATA = com.endlessm.CodingGameService.service

com.endlessm.CodingGameService.service: $(srcdir)/com.endlessm.CodingGameService.service.in
	$(AM_V_GEN) sed -e 's|@bindir[@]|${bindir}|g' $< > $@

# Script for placing files in the shared dir 
pkglibexec_SCRIPTS = files/coding-copy-files

files/coding-copy-files: files/coding-copy-files.js.in
	$(AM_V_GEN) mkdir -p files && \
	$(SED) -e 's,%coding_files_dir%,$(pkgdatadir)/files,g' < $< >$@.tmp && \
	mv -f $@.tmp $@ && \
	chmod +x $@

# Polkit policy
polkit_policydir = $(datadir)/polkit-1/actions
polkit_policy_DATA = com.endlessm.Coding.policy

com.endlessm.Coding.policy: com.endlessm.Coding.policy.in
	$(AM_V_GEN) mkdir -p data && \
	$(SED) -e 's,%pkglibexecdir%,$(pkglibexecdir),' < $< >$@.tmp && \
	mv -f $@.tmp $@

# Things to get rid of later
CLEANFILES += \
	$(bin_SCRIPTS) \
	$(service_DATA) \
	$(resources_built_sources) \
	$(gdbus_codegen_built_sources) \
	$(polkit_policy_DATA) \
	data/timeline.json \
	files/coding-copy-files.js \
	lib/config.js \
	$(NULL)
