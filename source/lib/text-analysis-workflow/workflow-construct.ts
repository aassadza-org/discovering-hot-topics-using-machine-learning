/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                     *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/


import { CfnPolicy, Effect, Policy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Function, IFunction } from '@aws-cdk/aws-lambda';
import { Chain, StateMachine, StateMachineType } from '@aws-cdk/aws-stepfunctions';
import { Aws, Construct } from '@aws-cdk/core';
import { LambdaToStepFunction } from '@aws-solutions-constructs/aws-lambda-step-function';

export interface WorkflowProps {
    readonly stateMachineType?: StateMachineType;
    readonly chain: Chain,
    readonly lambdaFunc?: IFunction,
}

export class Workflow extends Construct {
    private _stMachine: StateMachine

    constructor (scope: Construct, id: string, props: WorkflowProps) {
        super(scope, id);

        if (props.lambdaFunc != null && props.lambdaFunc != undefined) {
            const lambdaStepFunction = new LambdaToStepFunction(this, 'WorkflowEngine', {
                existingLambdaObj: props.lambdaFunc as Function,
                stateMachineProps: {
                    definition: props.chain,
                    ...(props.stateMachineType === StateMachineType.EXPRESS && {
                        stateMachineType: props.stateMachineType
                    })
                }
            });
            this._stMachine = lambdaStepFunction.stateMachine;
            const role = this._stMachine.node.findChild('Role') as Role;
            const cfnDefaultPolicy = role.node.findChild('DefaultPolicy').node.defaultChild as CfnPolicy;

            cfnDefaultPolicy.addMetadata('cfn_nag', {
                rules_to_suppress: [{
                    id: 'W76',
                    reason: 'The policy adds cloudwatch alarms and allows step function to invoke lambda tasks. Suppressing the '+
                        'SPCM violation as this policy is required to monitor as well as invoke specific tasks'
                }, {
                    id: 'W12',
                    reason: "The 'LogDelivery' actions do not support resource-level authorizations"
                }]
            });
        } else {
            const _stateMachineRole = new Role(this, 'StateMachineRole', {
                assumedBy: new ServicePrincipal(`states.${Aws.REGION}.amazonaws.com`),
            });

            const stateMachineLogPolicy = new Policy(this, 'StateMachineLogPolicy', {
                statements: [
                    new PolicyStatement({
                        actions: [
                            "logs:CreateLogDelivery",
                            "logs:GetLogDelivery",
                            "logs:UpdateLogDelivery",
                            "logs:DeleteLogDelivery",
                            "logs:ListLogDeliveries",
                            "logs:PutResourcePolicy",
                            "logs:DescribeResourcePolicies",
                            "logs:DescribeLogGroups"
                        ],
                        resources: [ `arn:${Aws.PARTITION}:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:*` ],
                        effect: Effect.ALLOW
                    })
                ]
            });

            _stateMachineRole.attachInlinePolicy(stateMachineLogPolicy);

            this._stMachine = new StateMachine(this, 'WorkflowEngine', {
                definition: props.chain,
                ...(props.stateMachineType === StateMachineType.EXPRESS && {
                    stateMachineType: props.stateMachineType,
                    role: _stateMachineRole,
                })
            });

            this._stMachine.node.addDependency(_stateMachineRole);
        }
    }

    public get stateMachine(): StateMachine {
        return this._stMachine;
    }
}
