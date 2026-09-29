---
source-type: note
topics: [python]
date: 2026-10-11
---

# quick notes — why bother with a virtualenv

installed a package globally for a course assignment, it broke Budget CLI's dependencies, spent an hour figuring out why. writing this down before I forget, haven't read anything official yet — just what I pieced together from the error messages.

a virtual environment seems to be a private copy of the Python interpreter + its own `site-packages` folder, separate from the system one. `python -m venv .venv` creates it, `source .venv/bin/activate` switches the shell to use it. while it's active, `pip install` puts packages in the venv's folder, not the system one.

so two projects can want different versions of the same library and not fight, as long as each has its own venv. still not sure: does the venv folder need to be committed to git, or is it supposed to be recreated on each machine? need to check.
