#!/usr/bin/env python
#
# This is the first python file that you'll be editing on Endless OS.
#
# Don't worry! This human-language text here is not code. It is often
# useful to write some human-language text within code files so that
# the author can explain what is going on and other humans can read
# and understand it more quickly. Any line that starts with a '#'
# is called a 'comment' and ignored by Python. That means we can
# write whatever we want here! 
#
# This file  has a few functions, which I will go over, but the program
# doesn't work! You'll need to fix some of the functions in order to
# make things produce the right answer.
#
# So far you've written code using simple one-line commands, but most
# programs are useful because they combine multiple commands together
# into a useful program. When you're writing all those commands, they
# are evaluated in a straight-line order, one after the other.
#
# Clearly, if you want to do anything complicated, you'll need to have
# something better than that. The concept of a function helps a lot
# with this.
#
# Functions are essentially a way to give a name to a chunk of code
# so that you can refer to it by name later. You 'call' a function by
# using its name, followed by parenthesis containing its 'arguments',
# or the parameters it needs to have in order to start running.
#
#    my_awesome_function(my_name, your_name, age)
#
# As long as you're calling my_awesome_function with parameters that
# are the right type (string, string, number), you can pass anything
# you want and it will run accordingly.
#
# Most of the time, you will want your function to compute something
# for you, whether that be a number, a string or even putting together
# an object that you can use. When your function is done, it will
# 'return' this value and you can use it in the caller:
#
#    silly_name = my_awesome_function(my_name, your_name, age)
#    print(silly_name)
#    > MEMGOO21
#
# At other times, a function might have a 'side-effect', which is to
# say that it will modify the state of either the currently running
# program or the operating system it is running on. For instance,
# it might call the 'print' function to show a new line of text
# on the terminal.
#
# Generally speaking you should prefer to return values directly
# instead of setting things indirectly with side effects. This makes
# functions 'composable', which becomes a very powerful code-reuse
# tool.


# This is an "import", which is to say that we'll be using some code
# from elsewhere on the system in this file
import argparse
import sys


def multiply_by_self(number):
    """Multiplies a number by itself.

    Here is the definition of a function. The syntax for defining
    a function in Python is always the keyword 'def', followed by
    the function name, followed by parenthesis containing the names
    of parameters the function will require, followed by a colon (':').

    You'll notice that everything inside of here appears to be offset
    by four spaces. This is intentional! In most programming languages
    we use indentation as a way to visually indicate the structure of
    our programs. For instance, it is visually clear that this code
    is a part of this function, whereas code that is 'outside'
    the function is not a part of it. Because this is such a
    common convention, it is actually a part of the language in Python -
    anything on the same indent level or above is considered to be
    in 'scope' and accessible to any code that is currently running.

    The main rule is that you can see 'outside' your scope, but
    you can't see 'inside' another one. So code running outside
    of this function can't go modify variables within it.

    Once we're done writing the code that we want to be a part of
    this function, we just go back to the same indent level as
    before.

    One more thing - you'll notice these lines come up green and are
    in human-language but not followed by a '#' symbol. Python treats
    anything within three quotation marks as a 'docstring', which is
    similar to a comment, but has a slightly more expanded semantic
    meaning. For instance, because this docstring with the very first
    piece of 'code' within this function, Python knows that the
    docstring is 'documenting' this function. So, for instance,
    if you typed 'help(multiply_by_self)' whilst this file was
    imported, you'd see this string.
    """
    return number * number


def subtract_one_half(number, to_halve):
    """Subtract one half of two_halve from number.

    This function has two arguments, so it needs to be provided
    with both in order to work.
    """
    return number - to_halve / 2


def remove_evens(numbers):
    """Remove even numbers from numbers.
    
    This function is incomplete! Can you add the remaining bit
    of code here to complete it?"""
    return [n for n in numbers]


def corresponding_letter(number):
    """Find a corresponding letter in the alphabet for number.
    
    If the number is out of range, just wrap-around.
    """
    return chr((number % 24) + ord('a'))


def capitalise_vowels(string):
    """Capitalise any letter that is a vowel."""
    vowels = ['a', 'e', 'i', 'o', 'u']

    def maybe_capitalise(letter):
         """Capitalise this letter if it is a vowel.
         
         Notice that you can define a function within a function? This
         function, maybe_capitalise, is only visible to capitalise_vowels
         because of the scoping rules. But this function itself also has
         access to capitalise_vowels' 'closure'. That means that you can
         access the value of 'string' or any variable defined in
         capitalise_vowels.
         """
         if letter in vowels:
             return letter.upper()

         return letter

    return "".join([maybe_capitalise(l) for l in string])


def main():
    """The main function that does everything

    The main function usually evaluates the command line arguments
    passed to the program and then runs functions within the program
    to compute a result.
    """
    parser = argparse.ArgumentParser("Function Combiner")
    parser.add_argument("numbers",
                        nargs="*",
                        help="The numbers to encode")
    parse_result = parser.parse_args(sys.argv[1:])

    # Convert strings containing numbers into actual numbers
    numbers = [int(n) for n in parse_result.numbers]

    # Can you call the functions in the right order? To generate an
    # encoded string from some numbers, first remove all the even
    # numbers, then for each number:
    #   1. subtract one half of itself multiplied by five
    #   2. multiply the result by itself
    #
    # Then, convert all those numbers to letters using the
    # corresponding_letter function.
    #
    # Then, capitalise all the vowels.
    result = capitalise_vowels([
        corresponding_letter(multiply_by_self(subtract_one_half(n, n * 5)))
        for n in remove_evens(numbers)
    ]) 

    print(result)


# Here, we just detect if we're running this module, or if we imported it. If
# we are running it, then start executing the main() function
if __name__ == "__main__":
    main()

