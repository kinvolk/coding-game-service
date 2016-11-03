#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])
AC_INIT([com.endlessm.CodingGameService],
        [0.0.0],
        [https://phabricator.endlessm.com],
        [com.endlessm.CodingGameService],
        [http://www.endlessm.com])
AM_INIT_AUTOMAKE([1.12 dist-xz no-dist-gzip foreign tar-ustar subdir-objects])
AM_SILENT_RULES([yes])

# Set up libtool
LT_INIT

# Set up GObject-Introspection
GOBJECT_INTROSPECTION_CHECK([1.30.0])

# Checks for programs.

# Checks for libraries.
PKG_CHECK_MODULES(CODING_GAME_SERVICE, [glib-2.0 gio-2.0 gobject-2.0 gio-unix-2.0])

# Checks for header files.

# Checks for typedefs, structures, and compiler characteristics.

# Checks for library functions.

# Substitute variables
AC_CONFIG_FILES([Makefile])
AC_OUTPUT
