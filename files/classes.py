#!/usr/bin/env python
#
# This python file contains some things called 'classes', which can
# be used to construct other things called 'objects'.
#
# There's a scenario that needs to be played out in this file, except
# that one of the classes does not have an implementation! You'll need
# to provide the implementation and then run the program to determine
# the right order of events.
import argparse
import sys


class CreditCard(object):
    """A credit card for an account.

    Money on a credit card can be spent outside hours.
    """

    def __init__(self, account):
        """Initialise this CreditCard with the specified account."""
        super(CreditCard, self).__init__()
        self._account = account

    def spend(self, amount):
        """Spend the specified amount by withdrawing directly."""
        # You'll need to implement this method! Remove the 'pass'
        # statement and add an implementation.
        pass


class Account(object):
    """An account has a balance and a name.

    If the balance is negative, then it goes into 'overdraft' mode.

    Every account has an associated credit card.
    """

    def __init__(self, amount, name):
        """Initialise this Account with the specified amout and name.

        These kinds of methods are known in object-oriented programming
        languages as 'constructors'. They take some parameters and use
        that to create an object.
        """
        # If this class had a parent, we'll want to initialise the
        # parent too.
        super(Account, self).__init__()

        # The special 'self' variable, for functions inside of
        # a class, refers to the 'class instance'. You might have
        # special 'properties' set on each instance that you can
        # access from within the methods of that class instance.
        #
        # In python, the convention is that any method starting with
        # an underscore is 'private' and not to be accessed by
        # things outside the class.
        self._balance = amount
        self._name = name


    def withdraw(self, amount):
        # Oops, you shouldn't be allowed to withdraw negative money!
        if amount <= 0:
            return 0

        if self._balance > 0:
            self._balance -= amount
            return amount


    def deposit(self, amount):
        # Oops, you shouldn't be allowed to deposit negative money!
        if amount < 0:
            return

        self._balance += amount

    def report(self):
        """Generate a report on this account's state."""
        return {
            "in_overdraft": self._balance < 0,
            "balance": self._balance,
            "name": self._name
        }

    def card(self):
        """Create a credit card for this account."""
        return CreditCard(self)


class Bank(object):
    """A bank has multiple accounts.
    
    Money can be withdrawn and deposited as long as it is open for
    business.

    Credit cards have special access and can withdraw money whenever
    they want.
    """

    def __init__(self):
        """Initialise this bank, with no accounts."""
        super(Bank, self).__init__()
        self._accounts = {}
        self._is_open = False


    def open(self):
        self._is_open = True


    def close(self):
        self._is_open = False


    def open_account(self, name):
        """Open a new account for name, if we don't have one."""
        if self._accounts.get(name, None):
            return None

        self._accounts[name] = Account(0, name)
        return self._accounts[name]

    def close_account(self, name):
        """Close account and get a report of its state."""
        if self._accounts.get(name, None):
            report = self._accounts[name].report()
            del self._accounts[name]
            return report

        return None

    def withdraw_money(self, name, amount):
        """Withdraw money at the bank, if possible."""
        # You'll need to implement this method!
        #
        # Remove the 'pass' statement and fill in the implementation
        # for this method.
        pass

    def deposit_money(self, name, amount):
        """Deposit money at the bank, if possible."""
        # You'll need to implement this method!
        pass

    def who_is_overdrafted(self):
        """Generate an array of account names that are overdrafted."""
        # You'll need to implement this method!
        return []


def scenario():
    """A simple banking scenario."""
    bank = Bank()
    bank.open()

    alan = bank.open_account("alan")
    bob = bank.open_account("bob")
    alice = bank.open_account("alice")

    bank.deposit_money("alan", 100)
    bank.deposit_money("bob", 50)
    bank.deposit_money("alice", 150)

    credit = alice.card()

    bank.deposit_money("alice", bank.withdraw_money("bob", 20))
    bank.deposit_money("alan", bank.withdraw_money("bob", 40))

    # Bank closed
    bank.close()
    bank.deposit_money("bob", bank.withdraw_money("alan", 10))

    credit.spend(40)

    return bank.who_is_overdrafted()


def main():
    """The main function that runs the scenrio and prints a result"""
    print(" ".join(scenario()))


# Here, we just detect if we're running this module, or if we imported it. If
# we are running it, then start executing the main() function
if __name__ == "__main__":
    main()

