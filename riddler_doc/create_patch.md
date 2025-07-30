git diff > my_diff_patch_with_tests.patch
git diff -- . :(exclude)*__tests__* > my_diff_patch.patch