# Arbitrary files
arbitrary_files = \
	files/sw.txt \
	files/test.txt \
	files/org.processing.App.desktop \
	files/classes.py \
	files/functions.py \
	files/processing.png \
	files/line.png \
	files/circle.png \
	files/circle_key.png \
	files/codeview-builder.png \
	files/builder-overview.png \
	files/codeview-icon.png \
	files/line_key.png \
	files/martian.png \
	files/martian_colors.png \
	files/coding-terminal.desktop \
	files/showmehow-terminal \
	files/line/line.pde \
	files/martian/martian.pde \
	files/wave/wave.pde \
	files/eos-shell-extension-prefs.desktop \
	files/extension-todo.png \
	$(NULL)

filesdir = $(pkgdatadir)
nobase_files_DATA = $(arbitrary_files)

# Resource javascript modules
resource_dist_js_files = \
	lib/controller.js \
	lib/communicator.js \
	lib/desktopFile.js \
	lib/log.js \
	lib/service.js \
	lib/validation.js \
	lib/shellAppStore.js \
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

# Mocks
javascript_mocks = \
	mocks/constructors.js \
	$(NULL)

# Tests
javascript_tests = \
	tests/js/testCodingGameService.js \
	tests/js/testCodingGameServiceTimeline.js \
	$(NULL)

# All javascript modules
all_dist_js_files = \
	bin/coding-game-validator.js \
	bin/coding-game-service.js.in \
	bin/edit-desktop-file.js \
	$(javascript_mocks) \
	$(javascript_tests) \
	$(resource_dist_js_files) \
	$(NULL)

all_js_files = \
	$(all_dist_js_files) \
	$(resource_nondist_js_files) \
	$(NULL)

AM_CONFIG_MACRO_DIR =
AM_DISTCHECK_CONFIGURE_FLAGS = --enable-introspection
if EOS_ENABLE_COVERAGE
AM_DISTCHECK_CONFIGURE_FLAGS += --enable-coverage --with-coverage-dir=@EOS_COVERAGE_DIR@
endif EOS_ENABLE_COVERAGE
EXTRA_DIST = \
	com.endlessm.CodingGameService.xml \
	com.endlessm.CodingGameService.service.in \
	com.endlessm.CodingGameService.gresource.xml \
	bin/coding-dev-reset \
	bin/coding-terminal \
	data/timeline.json.unvalidated.in \
	com.endlessm.Coding.policy.in \
	files/coding-copy-files.js.in \
	lib/config.js.in \
	jasmine.json \
	$(all_dist_js_files) \
	$(arbitrary_files) \
	$(NULL)
CLEANFILES =

# GDBus-Codegen for CodingGameService
CodingGameService.c: $(srcdir)/com.endlessm.CodingGameService.xml
	gdbus-codegen --generate-c-code CodingGameService --c-namespace CodingGameService --c-generate-object-manager --interface-prefix com.endlessm. $<

CodingGameService.h: CodingGameService.c

gdbus_codegen_built_sources = CodingGameService.c CodingGameService.h
coding_game_service_shim_sources = lib/shim.c lib/shim.h

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

resourcedir = $(pkgdatadir)
resource_DATA = com.endlessm.CodingGameService.gresource

com.endlessm.CodingGameService.gresource: $(srcdir)/com.endlessm.CodingGameService.gresource.xml $(resource_files)
	$(AM_V_GEN) glib-compile-resources --target=$@ --sourcedir=$(srcdir) --sourcedir=$(builddir) $<

# Generate the CodingGameService GDBus Skeleton library
libcoding_game_service_1_0_la_SOURCES = $(gdbus_codegen_built_sources) \
					$(coding_game_service_shim_sources) \
					$(NULL)
libcoding_game_service_1_0_la_CFLAGS = $(CODING_GAME_SERVICE_CFLAGS)
libcoding_game_service_1_0_la_LIBADD = $(CODING_GAME_SERVICE_LIBS)

# All libraries
lib_LTLIBRARIES = libcoding_game_service-1.0.la

# Scripts to install
bin_SCRIPTS = \
	coding-dev-reset \
	coding-game-service \
	coding-game-validator \
	coding-terminal \
	$(NULL)

coding-dev-reset: $(srcdir)/bin/coding-dev-reset
	cp $< $@
	chmod +x $@

coding-game-service: $(srcdir)/bin/coding-game-service.js.in
	$(AM_V_GEN) sed -e 's,%PKGDATADIR%,$(pkgdatadir),g' $< > $@.tmp && mv -f $@.tmp $@
	chmod +x $@

coding-game-validator: $(srcdir)/bin/coding-game-validator.js
	cp $< $@
	chmod +x $@

coding-terminal: $(srcdir)/bin/coding-terminal
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

#  Run tests when running 'make check'
TESTS = \
	$(javascript_tests) \
	run_coverage.coverage \
	$(NULL)
LOG_COMPILER = gtester
AM_LOG_FLAGS = -k --verbose

TEST_EXTENSIONS = .js .coverage

JS_LOG_DRIVER = env AM_TAP_AWK='$(AWK)' $(SHELL) $(top_srcdir)/tap-driver.sh
JS_LOG_DRIVER_FLAGS = --comments
JS_LOG_COMPILER = jasmine
AM_JS_LOG_FLAGS = --tap --no-config @JASMINE_REPORT_ARGUMENT@

# Use locally built versions of CodingGameService-1.0.gir, JS modules, and
# libraries. We clobber GJS_PATH and include the js directory and the
# $(top_srcdir) for including test helper files.
# (May need to change to AM_TESTS_ENVIRONMENT in a later version of Automake)
TESTS_ENVIRONMENT = \
	export GJS_PATH="$(top_srcdir):$(top_srcdir)/js"; \
	export GI_TYPELIB_PATH="$(top_builddir)$${GI_TYPELIB_PATH:+:$$GI_TYPELIB_PATH}"; \
	export LD_LIBRARY_PATH="$(top_builddir)/.libs$${LD_LIBRARY_PATH:+:$$LD_LIBRARY_PATH}"; \
	export G_TEST_SRCDIR="$(abs_srcdir)/tests"; \
	export G_TEST_BUILDDIR="$(abs_builddir)/tests"; \
	export LC_ALL=C; \
	$(NULL)

# # # COVERAGE # # #

# Don't specify the resource:/// URIs here, because the tests load modules from
# the local directory, not from the GResource
EOS_JS_COVERAGE_FILES := $(patsubst $(srcdir)/%,%,$(wildcard $(srcdir)/lib/*.js))

@EOS_COVERAGE_RULES@

AM_JS_LOG_FLAGS += @EOS_JS_COVERAGE_LOG_FLAGS@

# Things to get rid of later
CLEANFILES += \
	$(bin_SCRIPTS) \
	$(service_DATA) \
	$(gdbus_codegen_built_sources) \
	$(polkit_policy_DATA) \
	com.endlessm.CodingGameService.gresource \
	data/timeline.json \
	files/coding-copy-files \
	lib/config.js \
	$(NULL)
