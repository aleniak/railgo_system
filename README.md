# Wagon Failure Risk GitHub Pages Demo

This static site is built from the uploaded trained two-tower PyTorch model and the uploaded CSV dataset.

## What is real here
- wagon-level 14d and 90d risk scores come from the real trained model
- the wagon list and all profile fields come from the uploaded CSV

## Factor panels
The factor panels are attached descriptive drivers derived from the wagon input profile and shown together with each real model prediction.

## Wagon IDs
The uploaded CSV did not include an explicit wagon identifier column, so synthetic IDs (`WGN-0001`, `WGN-0002`, ...) were generated.
